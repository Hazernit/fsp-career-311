import type { Grade, Specialization } from './tests.ts';
import type { FspAchievement, MatchCandidate } from './matching.ts';

/** Synthetic demo records; names, emails, phones, employers and achievements are invented. */
export const SEED_VERSION='fsp-synthetic-portfolio-1.0.0';
export interface SyntheticCandidate extends MatchCandidate {
  email:string;
  phone:string;
  bio:string;
  achievements:FspAchievement[];
  claimedGrade:Grade;
  experienceYears:number;
  fspId?:string;
  synthetic:true;
}
export interface MockFspIdentity {
  fspId:string;
  name:string;
  participantName:string;
  proofCode:string;
  achievements:FspAchievement[];
  source:'mock-fsp';
}

const categorySkills:Record<Specialization,Record<Grade,string[]>>={
  backend:{junior:['Python','SQL','HTTP','Git','Algorithms','Security'],middle:['SQL','Async','HTTP','Python','Architecture','Security']},
  frontend:{junior:['HTML','CSS','JavaScript','React','Accessibility','HTTP'],middle:['React','TypeScript','Async','CSS','Security','Testing']},
};
const names=[
  'Алексей Миронов','Мария Соколова','Тимур Волков','Анна Белова','Максим Орлов','Дарья Морозова','Илья Фомин','Елена Крылова',
  'Денис Кузнецов','Анастасия Лебедева','Роман Титов','Софья Павлова','Артём Никитин','Полина Громова','Никита Зайцев','Виктория Захарова',
  'Кирилл Ковалёв','Алиса Сергеева','Матвей Власов','Ева Романова','Андрей Лазарев','Вероника Куликова','Михаил Андреев','Ольга Воронова',
  'Глеб Макаров','Ксения Ершова','Павел Васильев','Диана Фёдорова','Владимир Сидоров','Кристина Филиппова','Сергей Медведев','Юлия Алексеева',
];
const cities=['Москва','Казань','Санкт-Петербург','Новосибирск','Екатеринбург','Нижний Новгород','Самара','Томск'];
const industries=['Медиа','Финтех','E-commerce','Государственные сервисы','Образование','Медицина','Образование','HRTech'];
const contexts=[
  'Работал над медиапорталом и редакторскими инструментами. В резюме указан широкий стек, часть компетенций ещё не подтверждена.',
  'Разрабатывал банковский личный кабинет, платёжные сценарии и обработку ошибок. Умеет объяснить решения и ограничения.',
  'Делал каталог товаров и оформление заказов интернет-магазина. Изучал надёжность форм и совместимость интерфейсов API.',
  'Разрабатывал государственный сервис с разграничением доступа и обработкой персональных данных.',
  'Создавал учебную платформу и кабинеты учеников. Важны доступность, понятные формы и проверка результата.',
  'Разрабатывал сервис записи в клинику. Работает с критичными данными, проверяет границы и обрабатывает ошибки.',
  'Поддерживал старый образовательный портал. Стек заявлен в резюме; тест выявил пробелы в отдельных компетенциях.',
  'Создавал карьерный сервис для кандидатов и работодателей: профили, подбор и адресные приглашения.',
];
// Selection is fixed before evaluation. Three demonstrated skills correspond to 9/12 correct,
// four to 10/12, five to 11/12, six to 12/12 (other competencies have one correct response).
const strongIndexes=[[0,3,4],[0,1,2,3,5],[0,1,2,5],[1,2,4,5],[0,1,3,4],[0,1,2,3,4,5],[0,3,4],[0,1,2,4,5]];
const declaredIndexes=[[0,1,2,3,4,5],[0,1,2,3,5],[0,1,2,5],[1,2,4,5],[0,1,3,4],[0,1,2,3,4,5],[0,1,2,3,4,5],[0,1,2,4,5]];

const portfolio:SyntheticCandidate[]=[];
for(const specialization of ['backend','frontend'] as Specialization[]) {
  for(const grade of ['junior','middle'] as Grade[]) {
    const skills=categorySkills[specialization][grade];
    for(let persona=0;persona<8;persona++) {
      const index=portfolio.length,id=`demo-c${String(index+1).padStart(2,'0')}`;
      const demonstratedSkills=strongIndexes[persona].map(i=>skills[i]);
      const correct=6+demonstratedSkills.length;
      portfolio.push({
        id,name:names[index],email:`candidate${index+1}@fsp-demo.example`,phone:`+7 (000) 000-${String(index+1).padStart(2,'0')}-00`,
        title:`${specialization==='backend'?'Backend':'Frontend'} разработчик · ${grade==='junior'?'Junior':'Middle'}`,city:cities[persona],
        specialization,verifiedGrade:grade,claimedGrade:grade,category:`${specialization==='backend'?'Backend':'Frontend'} · ${grade==='junior'?'Junior':'Middle'}`,
        skills:[...declaredIndexes[persona].map(i=>skills[i]),...(persona===0?['Docker','Python']:[])],demonstratedSkills,testScore:Math.round(correct/12*100),
        industry:industries[persona],bio:contexts[persona],experienceYears:grade==='junior'?1+persona%2:3+persona%4,
        achievements:[],fspVerified:false,contactUnlocked:false,synthetic:true,
      });
    }
  }
}

const registryFixtures=[
  {candidateIndex:1,skill:'Algorithms',discipline:'Алгоритмическое программирование',place:2,team:false},
  {candidateIndex:7,skill:'Python',discipline:'Разработка программного продукта',place:1,team:true},
  {candidateIndex:13,skill:'Architecture',discipline:'Разработка программного продукта',place:3,team:true},
  {candidateIndex:17,skill:'React',discipline:'Разработка интерфейса программного продукта',place:2,team:true},
  {candidateIndex:23,skill:'React',discipline:'Разработка интерфейса программного продукта',place:1,team:true},
  {candidateIndex:29,skill:'Testing',discipline:'Разработка программного продукта',place:3,team:true},
];
export const mockFspRegistry:MockFspIdentity[]=registryFixtures.map((fixture,index)=>{
  const candidate=portfolio[fixture.candidateIndex],fspId=`FSP-DEMO-${String(index+1).padStart(4,'0')}`;
  const achievement:FspAchievement={id:`mock-achievement-${index+1}`,event:`Демо-соревнование ФСП ${2025+index%2}`,discipline:fixture.discipline,date:index%2?'2026-05-15':'2025-11-20',result:`${fixture.place} место${fixture.team?' команды':''}`,place:fixture.place,team:fixture.team,source:'mock-fsp',verified:true,skills:[fixture.skill]};
  candidate.fspId=fspId;candidate.fspVerified=true;candidate.achievements=[achievement];
  return {fspId,name:candidate.name,participantName:candidate.name,proofCode:`DEMO-${index+1}-VERIFY`,achievements:[achievement],source:'mock-fsp'};
});
export const syntheticCandidates:SyntheticCandidate[]=portfolio;
