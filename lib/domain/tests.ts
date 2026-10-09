/** Reproducible assessment bank. Private answer keys never leave the server. */
export type Specialization = 'backend' | 'frontend';
export type Grade = 'junior' | 'middle';
export const TEST_VERSION = 'fsp-assessment-1.0.0';
export const GRADE_CHANGE_DAYS = 90;

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  skill: string;
  family: string;
}
export interface PrivateAnswer {
  optionId: string;
  rationale: string;
}
export interface Exam {
  version: string;
  specialization: Specialization;
  grade: Grade;
  seed: string;
  durationSeconds: number;
  threshold: number;
  questions: ExamQuestion[];
  answerKey: Record<string, PrivateAnswer>;
}
export interface ExamResult {
  version: string;
  passed: boolean;
  score: number;
  threshold: number;
  correct: number;
  total: number;
  feedback: { questionId: string; skill: string; correct: boolean; rationale: string }[];
  demonstratedSkills: string[];
  skillScores: Record<string, number>;
  recommendation: string;
}
interface Item { family: string; skill: string; prompt: string; answer: string; distractors: string[]; rationale: string }
type Rng = () => number;
type Family = (rng: Rng) => Item;

export function seededRandom(seed: string): Rng {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function integer(rng: Rng, min: number, max: number): number { return min + Math.floor(rng() * (max - min + 1)); }
function pick<T>(rng: Rng, items: T[]): T { return items[integer(rng, 0, items.length - 1)]; }
function shuffled<T>(rng: Rng, items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = integer(rng, 0, i); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function item(family: string, skill: string, prompt: string, answer: string, distractors: string[], rationale: string): Item {
  return { family, skill, prompt, answer, distractors, rationale };
}

const jsArray: Family = rng => {
  const start = integer(rng, 2, 9), multiplier = integer(rng, 2, 5);
  const values = Array.from({ length: 5 }, (_, i) => start + i);
  const expected = values.filter(x => x % 2 === 0).map(x => x * multiplier).reduce((a, b) => a + b, 0);
  return item('js-array-pipeline', 'JavaScript', `Что вернёт JavaScript?\n[${values.join(', ')}].filter(x => x % 2 === 0).map(x => x * ${multiplier}).reduce((sum, x) => sum + x, 0)`, String(expected), [String(expected / multiplier), String(values.reduce((a,b)=>a+b,0)*multiplier), String(expected+multiplier)], 'filter оставляет чётные числа, map умножает каждое из них, reduce складывает результат.');
};
const jsScope: Family = rng => {
  const initial = integer(rng, 2, 12), increment = integer(rng, 2, 7);
  return item('js-closure-state', 'JavaScript', `Что выведет последний console.log?\nfunction counter() { let value = ${initial}; return () => value += ${increment}; }\nconst next = counter();\nnext();\nconsole.log(next());`, String(initial+2*increment), [String(initial+increment),String(initial),String(2*increment),'0'], 'Замыкание сохраняет одну переменную value. Два вызова увеличивают её дважды.');
};
const pythonArray: Family = rng => {
  const start=integer(rng,2,9),multiplier=integer(rng,2,5),values=Array.from({length:5},(_,i)=>start+i);
  const expected=values.filter(x=>x%2===0).reduce((sum,x)=>sum+x*multiplier,0);
  return item('python-comprehension-sum','Python',`Что выведет Python?\nvalues = [${values.join(', ')}]\nprint(sum(x * ${multiplier} for x in values if x % 2 == 0))`,String(expected),[String(expected/multiplier),String(values.reduce((a,b)=>a+b,0)*multiplier),String(expected+multiplier)],'Условие генератора оставляет чётные числа, выражение умножает их, sum складывает результат.');
};
const pythonScope: Family = rng => {
  const initial=integer(rng,2,12),increment=integer(rng,2,7);
  return item('python-nonlocal-closure','Python',`Что выведет Python?\ndef counter():\n    value = ${initial}\n    def next_value():\n        nonlocal value\n        value += ${increment}\n        return value\n    return next_value\nnext_value = counter()\nnext_value()\nprint(next_value())`,String(initial+2*increment),[String(initial+increment),String(initial),String(2*increment),'0'],'nonlocal изменяет одну переменную окружающей функции. Замыкание сохраняет её между вызовами, поэтому увеличение выполняется дважды.');
};
const sqlAggregate: Family = rng => {
  const amounts = [integer(rng,10,30),integer(rng,40,70),integer(rng,80,120)], cancelled = integer(rng,100,200);
  return item('sql-filter-sum','SQL',`Таблица payments(amount, status) содержит (${amounts[0]}, 'paid'), (${amounts[1]}, 'paid'), (${cancelled}, 'cancelled'), (${amounts[2]}, 'paid'). Что вернёт SELECT SUM(amount) FROM payments WHERE status = 'paid'?`,String(amounts.reduce((a,b)=>a+b,0)),[String(amounts.reduce((a,b)=>a+b,0)+cancelled),String(amounts[0]+amounts[1]),String(amounts.length)],'WHERE исключает cancelled до выполнения SUM. Складываются суммы только трёх оплаченных строк.');
};
const sqlJoin: Family = rng => {
  const users = integer(rng,4,9), unmatched = integer(rng,1,3), orders = users-unmatched;
  return item('sql-left-join-null','SQL',`В users есть ${users} строк. У ${orders} разных пользователей ровно по одному заказу, у остальных заказов нет. Что вернёт SELECT COUNT(*) FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.id IS NULL?`,String(unmatched),[String(users),String(orders),String(unmatched+1),'0'],'LEFT JOIN сохраняет пользователей без заказа. Для них o.id равен NULL, поэтому фильтр оставляет именно их.');
};
const httpStatus: Family = rng => {
  const example = pick(rng,[{scenario:'запрос без токена к закрытому ресурсу',answer:'401 Unauthorized',rationale:'401 означает отсутствие или недействительность аутентификации.'},{scenario:'пользователь вошёл, но не имеет права читать чужой документ',answer:'403 Forbidden',rationale:'403 означает отказ в доступе уже аутентифицированному пользователю.'},{scenario:'успешное создание нового ресурса',answer:'201 Created',rationale:'201 сообщает об успешном создании ресурса.'},{scenario:'успешное удаление ресурса, тело ответа отсутствует',answer:'204 No Content',rationale:'204 означает успешный запрос без тела ответа.'}]);
  return item('http-status-semantics','HTTP',`Какой статус HTTP точнее соответствует сценарию: ${example.scenario}?`,example.answer,['200 OK','401 Unauthorized','403 Forbidden','201 Created','204 No Content'].filter(x=>x!==example.answer),example.rationale);
};
const httpSafe: Family = rng => {
  const resource=pick(rng,['профиля','заказа','каталога']);
  return item('http-safe-method','HTTP',`Клиент только читает данные ${resource}. Какой HTTP-метод должен выполнять такую операцию без изменения состояния сервера?`,'GET',['POST','PATCH','DELETE'],'GET — безопасный метод чтения. Изменять серверное состояние запросом GET нельзя.');
};
const gitUndo: Family = rng => {
  const branch=pick(rng,['main','release','develop']);
  return item('git-public-revert','Git',`Ошибочный коммит уже отправлен в общую ветку ${branch}, коллеги успели получить его. Как безопасно отменить его изменения, сохранив общую историю?`,'git revert <commit>',['git reset --hard <commit> и force push','Удалить ветку и создать заново','git clean -fd'],'revert создаёт новый коммит с обратными изменениями и не переписывает общую историю.');
};
const gitStage: Family = rng => {
  const filename=pick(rng,['api.ts','profile.ts','schema.sql','tests.ts']);
  return item('git-selective-stage','Git',`Изменены несколько файлов. В следующий коммит должен попасть только ${filename}. Как подготовить его к коммиту?`,`git add ${filename}`,['git add .','git push','git checkout .'],'git add с конкретным путём помещает только выбранный файл в индекс.');
};
const algorithmLinear: Family = rng => {
  const size=integer(rng,50,500);
  return item('algorithm-linear-search','Algorithms',`В несортированном массиве из n элементов (сейчас n = ${size}) поиск последовательно сравнивает каждый элемент с целью. Какова временная сложность в худшем случае?`,'O(n)',['O(1)','O(log n)','O(n²)'],'В худшем случае проверяются все n элементов. Один проход имеет линейную сложность.');
};
const algorithmBinary: Family = rng => {
  const power=integer(rng,5,12), size=2**power;
  return item('algorithm-halving','Algorithms',`Диапазон из ${size} элементов каждый шаг делится пополам. Через сколько делений останется один элемент?`,String(power),[String(power+1),String(size/2),String(power-1)],`После k делений размер равен ${size}/2^k. Для одного элемента k = log₂(${size}) = ${power}.`);
};
const securitySQL: Family = rng => {
  const field=pick(rng,['email','username','city']);
  return item('security-sql-parameters','Security',`Значение ${field} поступает из формы. Как безопасно использовать его в SQL-запросе?`,'Параметризованный запрос с отдельной передачей значения',['Склеить строку SQL и значение','Удалить только пробелы','Проверять поле только в браузере'],'Параметризованные запросы отделяют данные от SQL-кода. Проверка только на клиенте не защищает сервер.');
};
const securityPasswords: Family = rng => {
  const app=pick(rng,['карьерная платформа','личный кабинет','портал команды']);
  return item('security-password-storage','Security',`Как ${app} должен хранить пароли пользователей?`,'Медленный парольный хэш с индивидуальной случайной солью',['Открытым текстом в закрытой таблице','Обычный SHA-256 без соли','Обратимое шифрование одним ключом в коде'],'Парольный KDF (например, Argon2id или PBKDF2) с солью затрудняет массовый перебор. Исходный пароль не хранится.');
};

const sqlGrouping: Family = rng => {
  const threshold=integer(rng,3,8);
  return item('sql-having-groups','SQL',`Нужно вывести department_id только тех отделов, где число сотрудников больше ${threshold}. Какой запрос корректен?`,`SELECT department_id FROM employees GROUP BY department_id HAVING COUNT(*) > ${threshold}`, [`SELECT department_id FROM employees WHERE COUNT(*) > ${threshold} GROUP BY department_id`,`SELECT department_id FROM employees GROUP BY department_id WHERE COUNT(*) > ${threshold}`,`SELECT department_id FROM employees WHERE department_id > ${threshold}`],'WHERE фильтрует строки до группировки; HAVING фильтрует агрегированные группы после GROUP BY.');
};
const sqlTransaction: Family = rng => {
  const first=integer(rng,100,300),second=integer(rng,100,300),transfer=integer(rng,10,70);
  return item('sql-atomic-transfer','SQL',`Перевод ${transfer} ₽ между счетами с остатками ${first} ₽ и ${second} ₽ выполняет UPDATE списания и UPDATE зачисления. После списания процесс падает. Как обеспечить принцип «оба изменения или ни одного»?`,'Выполнить оба UPDATE в одной транзакции, при ошибке ROLLBACK',['Выполнять UPDATE в отдельных транзакциях','Добавить ORDER BY','Проверить баланс после ответа пользователю'],'Атомарная транзакция фиксирует все её изменения вместе либо откатывает их все.');
};
const asyncQueue: Family = rng => {
  const a=integer(rng,1,5),b=a+integer(rng,1,5),c=b+integer(rng,1,5);
  return item('python-asyncio-await-order','Async',`Каков порядок вывода Python?\nimport asyncio\nasync def child():\n    print(${b})\n    await asyncio.sleep(0)\n    print(${c})\nasync def main():\n    print(${a})\n    await child()\nasyncio.run(main())`,`${a}, ${b}, ${c}`,[`${a}, ${c}, ${b}`,`${b}, ${a}, ${c}`,`${c}, ${b}, ${a}`],'main печатает первое число, await выполняет child. child печатает второе, уступает цикл событий и после возобновления печатает третье. Других задач нет.');
};
const asyncLimit: Family = rng => {
  const tasks=integer(rng,8,15),limit=integer(rng,2,4);
  return item('python-bounded-concurrency','Async',`В Python asyncio нужно выполнить ${tasks} независимых HTTP-запросов, одновременно не больше ${limit}. Какой подход обеспечивает ограничение?`,`asyncio.Semaphore(${limit}) вокруг выполняемого запроса`,['asyncio.gather для всех запросов без ограничения','Последовательный for с await без параллелизма','Увеличить тайм-аут каждого запроса'],'Семафор допускает не больше заданного числа одновременно работающих секций. gather сам по себе число выполняющихся запросов не ограничивает.');
};
const pythonTyping: Family = rng => {
  const first=integer(rng,1,8),second=integer(rng,2,9);
  return item('python-runtime-type-hints','Python',`Что произойдёт в обычном CPython без валидаторов и проверки mypy?\ndef add(a: int, b: int) -> int:\n    return a + b\nprint(add('${first}', '${second}'))`,`Выведет строку '${first}${second}'`,['До вызова возникнет TypeError из-за аннотаций','Выведет число '+String(first+second),'Аннотации автоматически преобразуют строки в int'],'Аннотации типов сами по себе не проверяют и не преобразуют аргументы во время выполнения. Оператор + конкатенирует две строки.');
};
const pythonDefault: Family = rng => {
  const first=integer(rng,2,9),second=integer(rng,10,19);
  return item('python-mutable-default','Python',`Что выведет Python?\ndef collect(value, items=[]):\n    items.append(value)\n    return list(items)\ncollect(${first})\nprint(collect(${second}))`,`[${first}, ${second}]`,[`[${second}]`,`[${first}]`,'TypeError'],'Изменяемое значение аргумента по умолчанию создаётся один раз при определении функции и используется повторно. Для новой коллекции на каждый вызов нужен None и создание списка внутри функции.');
};
const httpRetry: Family = rng => {
  const operation=pick(rng,['создания платежа','создания заказа','выдачи приглашения']);
  return item('http-idempotency-key','HTTP',`Сервис ${operation} получил повторный POST после тайм-аута клиента. Как предотвратить повторное создание при повторе того же запроса?`,'Идемпотентный ключ и уникальная запись результата операции',['Запретить все повторные запросы','Использовать новый случайный ключ для каждой попытки','Полагаться только на кнопку disabled в браузере'],'Стабильный ключ повторяемой операции и уникальность на сервере позволяют вернуть прежний результат без повторного эффекта.');
};
const httpETag: Family = rng => {
  const etag=integer(rng,10,99);
  return item('http-conditional-cache','HTTP',`Клиент сохранил ответ с ETag: "v${etag}". Серверная версия не изменилась. Клиент отправляет If-None-Match: "v${etag}". Какой ответ экономит передачу неизменившегося тела?`,'304 Not Modified',['200 OK с полным телом','409 Conflict','412 Precondition Failed'],'При совпадении If-None-Match для GET сервер отвечает 304, позволяя клиенту использовать сохранённое представление.');
};
const typeNarrow: Family = rng => {
  const property=pick(rng,['text','label','name']);
  return item('typescript-null-narrowing','TypeScript',`При strictNullChecks поле ${property}: string | null. Как безопасно вызвать toUpperCase() и получить пустую строку при null?`,`value.${property}?.toUpperCase() ?? ''`,[`value.${property}!.toUpperCase()`,`String(value.${property}).toUpperCase()`,`value.${property}.toUpperCase()`],'Optional chaining не вызывает метод при null, а ?? подставляет значение только для null/undefined. Небезопасное ! не меняет поведение во время выполнения.');
};
const typeUnion: Family = rng => {
  const states=pick(rng,[['ok','error'],['success','failure'],['ready','failed']]);
  return item('typescript-discriminated-union','TypeScript',`type Result = { kind: '${states[0]}'; data: string } | { kind: '${states[1]}'; message: string }; Как безопасно получить data?`,`Проверить result.kind === '${states[0]}' перед обращением к result.data`,['Привести result к any','Читать result.data в обеих ветках','Использовать result.data!, не проверяя kind'],'Проверка дискриминатора сужает union до варианта с полем data.');
};
const architectureIndex: Family = rng => {
  const first=pick(rng,['company_id','project_id','team_id']);
  return item('architecture-composite-index','Architecture',`Частый запрос: SELECT * FROM items WHERE ${first} = ? ORDER BY created_at DESC LIMIT 20. Какой индекс соответствует фильтрации и сортировке?`,`(${first}, created_at)`,['(created_at, title)','(title)','Неиндексированный JSON со всеми полями'],'Первое поле составного индекса обслуживает точный фильтр, второе — порядок внутри найденной группы.');
};
const architectureOutbox: Family = rng => {
  const event=pick(rng,['приглашения','заказа','заявки']);
  return item('architecture-transactional-outbox','Architecture',`После записи ${event} в БД нужно надёжно отправить событие в очередь. Процесс может упасть между записью и отправкой. Как сократить риск потери события?`,'Сохранить запись и событие outbox одной транзакцией; повторяемый обработчик отправляет событие',['Сначала отправить событие, потом записать данные','Вызвать очередь без ожидания результата','Держать событие только в оперативной памяти'],'Транзакционный outbox связывает факт изменения и необходимость отправки. Обработчик с повторными попытками и идемпотентный потребитель обеспечивают доставку при сбоях.');
};
const securityAuthz: Family = rng => {
  const resource=pick(rng,['PDF резюме','приглашение','профиль']);
  return item('security-object-authorization','Security',`Пользователь меняет ID в URL и пытается прочитать чужой ${resource}. Где проверять право доступа?`,'На сервере для конкретного объекта и текущего пользователя при каждом запросе',['Только скрыть ссылку в интерфейсе','Разрешить доступ любому вошедшему','Проверять только формат UUID'],'Проверка объектных прав нужна на каждом серверном пути, включая PDF и API. Неугадываемый ID не заменяет авторизацию.');
};
const securityXSS: Family = rng => {
  const field=pick(rng,['описание профиля','описание компании','отзыв']);
  return item('security-untrusted-html','Security',`На странице выводится пользовательское ${field}. Как снизить риск XSS?`,'Выводить как текст с экранированием; HTML пропускать только через проверенный sanitizer',['Передать строку напрямую в innerHTML','Удалить только слово script','Проверять длину текста вместо экранирования'],'Экранирование отделяет данные от разметки. Если форматированный HTML нужен, требуется санитарная обработка с разрешённым списком элементов и атрибутов.');
};

const htmlLabel: Family = rng => {
  const field=pick(rng,['email','phone','city']);
  return item('html-associated-label','HTML',`Как связать видимую подпись с input id="${field}" для доступной формы?`,`<label for="${field}">Подпись</label>`,['<div>Подпись</div>','Только placeholder="Подпись"','<span title="Подпись">*</span>'],'label с for, соответствующим id, связывает подпись с полем для экранного диктора и при нажатии. В JSX атрибут называется htmlFor.');
};
const htmlButton: Family = rng => {
  const action=pick(rng,['Открыть фильтры','Сохранить черновик','Показать пароль']);
  return item('html-button-default','HTML',`Внутри form находится кнопка «${action}», которая не должна отправлять форму. Какой type указать?`,'type="button"',['type="submit"','type="reset"','Не указывать type'],'У button внутри формы по умолчанию type=submit. Явный button исключает отправку формы.');
};
const cssBox: Family = rng => {
  const width=integer(rng,100,250),padding=integer(rng,10,30),border=integer(rng,1,4);
  return item('css-content-box-width','CSS',`Элемент имеет width: ${width}px; padding: ${padding}px; border: ${border}px solid; box-sizing: content-box. Какова полная ширина без margin?`,`${width+2*padding+2*border}px`,[`${width}px`,`${width+padding+border}px`,`${width+2*padding}px`],'При content-box width относится к содержимому. Полная ширина включает padding и border с обеих сторон.');
};
const cssSpecificity: Family = rng => {
  const cls=pick(rng,['card','profile','panel']);
  return item('css-selector-specificity','CSS',`Все правила имеют одинаковую важность и слой, !important нет. Какие стили color применятся к <div id="main" class="${cls}">?\ndiv { color: blue; }\n.${cls} { color: green; }\n#main { color: red; }`,'red',['blue','green','Последнее правило в HTML'],'ID-селектор имеет более высокую специфичность, чем класс и тег при одинаковых происхождении, важности и слое.');
};
const reactState: Family = rng => {
  const initial=integer(rng,1,12),increment=integer(rng,1,5);
  return item('react-functional-state','React',`count = ${initial}. В одном обработчике React дважды вызвано setCount(c => c + ${increment}). Какой count будет после обработки очереди?`,String(initial+2*increment),[String(initial+increment),String(initial),String(2*increment),'0'],'Функциональные обновления последовательно получают результат предыдущего обновления.');
};
const reactKeys: Family = rng => {
  const entity=pick(rng,['кандидатов','заказов','товаров']);
  return item('react-stable-list-key','React',`Список ${entity} можно сортировать и удалять элементы. Какой key безопаснее для сохранения соответствия компонентов элементам?`,'Стабильный уникальный ID сущности',['Индекс элемента в массиве','Math.random() при каждом рендере','Одинаковая строка для всех элементов'],'Стабильный ID сохраняет идентичность элемента при перестановках. Индекс и случайный ключ могут приводить к неверному состоянию или лишнему пересозданию.');
};
const accessibilityFocus: Family = rng => {
  const name=pick(rng,['Удалить','Закрыть','Открыть меню']);
  return item('accessibility-icon-button','Accessibility',`Кнопка содержит только иконку «${name}». Что нужно пользователю экранного диктора?`,`Доступное имя, например aria-label="${name}"`,['Только цвет кнопки','Скрыть кнопку от экранного диктора','Запретить фокус клавиатурой'],'Доступное имя объясняет назначение кнопки, а клавиатурный фокус сохраняет её управляемость.');
};
const accessibilityKeyboard: Family = rng => {
  const component=pick(rng,['диалог','окно настройки','окно подтверждения']);
  return item('accessibility-modal-focus','Accessibility',`Открыт модальный ${component}. Как правильно управлять фокусом?`,'Перевести фокус внутрь, удерживать в диалоге и вернуть к вызвавшему элементу после закрытия',['Оставить фокус на скрытой части страницы','Установить tabindex="-1" всем кнопкам','Разрешить Tab уходить под модальное окно'],'Модальный диалог должен удерживать клавиатурную навигацию внутри. Восстановление фокуса сохраняет контекст пользователя.');
};
const reactEffect: Family = rng => {
  const field=pick(rng,['userId','projectId','query']);
  return item('react-effect-dependency','React',`Эффект загружает данные по пропсу ${field}. Он должен повторяться, когда ${field} изменяется. Как задать зависимости, если других внешних изменяемых значений эффект не использует?`,`[${field}]`,['[]','Не задавать массив зависимостей','[Math.random()]'],'Зависимости включают все реактивные значения, используемые эффектом. Одно поле в массиве запускает эффект при его изменении.');
};
const reactMemo: Family = rng => {
  const entity=pick(rng,['selectedIds','filters','items']);
  return item('react-immutable-update','React',`Состояние ${entity} хранит массив. Нужно удалить элемент по ID. Как обновить состояние без мутации?`,`setState(prev => prev.filter(item => item.id !== removedId))`,['Вызвать splice на исходном массиве и вернуть его','Удалить DOM-элемент вручную','Изменить свойство length исходного массива'],'Новый массив сохраняет неизменность прежнего состояния и позволяет React корректно определить обновление.');
};
const asyncRace: Family = rng => {
  const old=pick(rng,['a','py','rea']),next=old+pick(rng,['b','t','ct']);
  return item('async-stale-response','Async',`Поиск отправил запрос «${old}», затем «${next}». Ответ старого запроса пришёл последним. Как не заменить новые результаты старыми?`,'Отменять предыдущий запрос и/или проверять номер актуального запроса перед обновлением состояния',['Всегда применять последний пришедший ответ','Добавить setTimeout к каждому ответу','Очистить весь localStorage'],'Отмена и проверка идентификатора защищают состояние от устаревшего ответа при изменении запроса.');
};
const asyncAll: Family = rng => {
  const resources=pick(rng,['профиль и приглашения','каталог и фильтры','команда и проекты']);
  return item('async-partial-results','Async',`Нужно параллельно получить ${resources}. Ошибка одного запроса не должна скрыть успешный результат другого. Как получить оба исхода?`,'Promise.allSettled([...])',['Promise.all([...]) без обработки ошибки','Promise.race([...])','Не ожидать ни один promise'],'allSettled возвращает статус и результат каждого promise. all отвергается при первом отказе, race возвращает только первый завершившийся исход.');
};
const cssResponsive: Family = rng => {
  const min=pick(rng,[220,240,260]);
  return item('css-adaptive-grid','CSS',`Карточки должны автоматически занимать доступные колонки и переноситься. Минимальная ширина ${min}px, контейнер шире ${min}px. Какой шаблон CSS Grid подходит?`,`repeat(auto-fit, minmax(${min}px, 1fr))`,['repeat(4, 300px)','1000px','repeat(1, 1fr) при любой ширине'],'auto-fit подбирает число колонок, minmax задаёт минимум и распределяет свободное место между ними.');
};
const cssReducedMotion: Family = rng => {
  const animation=pick(rng,['появления карточки','открытия меню','переключения экрана']);
  return item('css-user-motion-preference','CSS',`Как учитывать предпочтение пользователя уменьшить анимацию ${animation}?`,'@media (prefers-reduced-motion: reduce) с уменьшением или отключением движения',['Проверять ширину экрана','Всегда ускорять анимацию вдвое','Определять предпочтение по User-Agent'],'prefers-reduced-motion сообщает о системной настройке пользователя. Сокращение движения снижает дискомфорт.');
};
const testingBoundary: Family = rng => {
  const min=integer(rng,2,10),max=integer(rng,20,40);
  return item('testing-inclusive-boundaries','Testing',`Поле принимает целые значения в диапазоне [${min}, ${max}] включительно. Какой набор лучше проверяет границы допустимости?`,`${min-1}, ${min}, ${max}, ${max+1}`,[`${min+1}, ${min+2}, ${max-2}, ${max-1}`,`${min}, ${min+1}, ${min+2}, ${min+3}`,`Только ${Math.floor((min+max)/2)}`],'Проверка обеих границ и соседних недопустимых значений обнаруживает ошибки включительности и off-by-one.');
};
const testingBehavior: Family = rng => {
  const action=pick(rng,['принять приглашение','сохранить профиль','опубликовать потребность']);
  return item('testing-user-observable-behavior','Testing',`Какой интеграционный тест надёжнее проверяет действие «${action}»?`,'Выполнить действие пользователем и проверить сохранённый результат и доступные пользователю изменения',['Проверить точное имя внутренней функции','Проверить количество локальных переменных','Подменить весь сервер и проверить только вызов mock'],'Поведенческий тест проверяет итог сквозного сценария, включая сохранение и права. Он меньше зависит от внутренней реализации.');
};

const blueprints: Record<Specialization, Record<Grade, Family[]>> = {
  backend: {
    junior: [pythonArray,pythonScope,sqlAggregate,sqlJoin,httpStatus,httpSafe,gitUndo,gitStage,algorithmLinear,algorithmBinary,securitySQL,securityPasswords],
    middle: [sqlGrouping,sqlTransaction,asyncQueue,asyncLimit,httpRetry,httpETag,pythonTyping,pythonDefault,architectureIndex,architectureOutbox,securityAuthz,securityXSS],
  },
  frontend: {
    junior: [htmlLabel,htmlButton,cssBox,cssSpecificity,jsArray,jsScope,reactState,reactKeys,accessibilityFocus,accessibilityKeyboard,httpStatus,httpSafe],
    middle: [reactEffect,reactMemo,typeNarrow,typeUnion,asyncRace,asyncAll,cssResponsive,cssReducedMotion,securityAuthz,securityXSS,testingBoundary,testingBehavior],
  },
};

export function generateExam(input: {specialization: Specialization; grade: Grade; seed: string; durationSeconds?: number}): Exam {
  const families = blueprints[input.specialization]?.[input.grade];
  if (!families) throw new Error('Неизвестная категория теста');
  const rng = seededRandom(`${TEST_VERSION}:${input.specialization}:${input.grade}:${input.seed}`);
  const answerKey: Record<string, PrivateAnswer> = {};
  const questions = shuffled(rng, families.map(family => family(rng))).map((entry,index) => {
    const id = `q${index+1}`;
    const values = [...new Set([entry.answer,...entry.distractors])];
    if (values.length < 4) throw new Error(`Недостаточно уникальных вариантов в ${entry.family}`);
    const options = shuffled(rng, [entry.answer,...shuffled(rng,values.filter(x=>x!==entry.answer)).slice(0,3)]).map((text,i)=>({id:`o${i+1}`,text}));
    answerKey[id] = {optionId:options.find(option=>option.text===entry.answer)!.id,rationale:entry.rationale};
    return {id,prompt:entry.prompt,options,skill:entry.skill,family:entry.family};
  });
  return {version:TEST_VERSION,specialization:input.specialization,grade:input.grade,seed:input.seed,durationSeconds:input.durationSeconds ?? 600,threshold:75,questions,answerKey};
}

export function publicExam(exam: Exam): Omit<Exam,'seed'|'answerKey'> {
  const {version,specialization,grade,durationSeconds,threshold,questions} = exam;
  return {version,specialization,grade,durationSeconds,threshold,questions};
}

export function evaluateExam(exam: Exam, answers: Record<string,string>): ExamResult {
  const grouped: Record<string,{correct:number,total:number}> = {};
  const feedback = exam.questions.map(question=>{
    const reference=exam.answerKey[question.id];
    const correct=answers[question.id]===reference.optionId;
    grouped[question.skill] ??= {correct:0,total:0};
    grouped[question.skill].total++;
    if (correct) grouped[question.skill].correct++;
    return {questionId:question.id,skill:question.skill,correct,rationale:reference.rationale};
  });
  const correct=feedback.filter(x=>x.correct).length,total=exam.questions.length,score=Math.round(correct/total*100);
  const skillScores=Object.fromEntries(Object.entries(grouped).map(([skill,count])=>[skill,Math.round(count.correct/count.total*100)]));
  const passed=score>=exam.threshold && Object.values(skillScores).every(value=>value>=50);
  return {version:exam.version,passed,score,threshold:exam.threshold,correct,total,feedback,skillScores,demonstratedSkills:Object.entries(skillScores).filter(([,value])=>value>=75).map(([skill])=>skill),recommendation:passed?'Грейд подтверждён тестом.':exam.grade==='middle'?'Грейд Middle не подтверждён. Можно самостоятельно выбрать тест Junior; понижения автоматически нет.':'Грейд не подтверждён. Изучите разбор компетенций и попробуйте новый вариант после подготовки.'};
}

export function canStartExam(input:{specialization:Specialization;grade:Grade;verifiedSpecialization?:Specialization|null;verifiedGrade?:Grade|null;lastVerifiedAt?:string|null;now?:string|Date}):{allowed:boolean;nextEligibleAt?:string;reason?:string} {
  if (!input.verifiedGrade || !input.lastVerifiedAt) return {allowed:true};
  // Same category retesting does not change the grade. Initial unsuccessful attempts create no cooldown.
  if (input.grade===input.verifiedGrade && input.specialization===input.verifiedSpecialization) return {allowed:true};
  const confirmedAt=Date.parse(input.lastVerifiedAt);
  if (!Number.isFinite(confirmedAt)) return {allowed:false,reason:'Не удалось проверить дату подтверждённого грейда.'};
  const nextEligibleAt=new Date(confirmedAt+GRADE_CHANGE_DAYS*86400000).toISOString();
  const now=input.now instanceof Date?input.now.getTime():Date.parse(input.now??new Date().toISOString());
  return now>=Date.parse(nextEligibleAt)?{allowed:true}:{allowed:false,nextEligibleAt,reason:`Подтверждённую категорию можно изменить через ${GRADE_CHANGE_DAYS} дней после успешного теста. Повторный тест текущей категории доступен.`};
}

export const assessmentCategories = (Object.keys(blueprints) as Specialization[]).flatMap(specialization=>(Object.keys(blueprints[specialization]) as Grade[]).map(grade=>({specialization,grade,category:`${specialization==='backend'?'Backend':'Frontend'} · ${grade==='junior'?'Junior':'Middle'}`,questions:12,threshold:75,durationSeconds:600})));
