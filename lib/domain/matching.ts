import type { Grade, Specialization } from './tests.ts';

export const ALGORITHM_VERSION = 'fsp-evidence-match-1.0.0';
export const MATCH_WEIGHTS = { demonstratedSkills: 55, testConfidence: 20, context: 15, declaredSkills: 5, achievements: 5 } as const;
export interface FspAchievement {
  id: string;
  event: string;
  discipline: string;
  date: string;
  result: string;
  place?: number;
  team?: boolean;
  source: 'mock-fsp' | 'fsp';
  verified: boolean;
  skills?: string[];
}
export interface Demand {
  id?: string;
  title?: string;
  description: string;
  specialization: Specialization;
  grade: Grade;
  skills: string[];
  mustHave: string[];
  industry?: string;
}
export interface MatchCandidate {
  id: string;
  name: string;
  title: string;
  city: string;
  specialization: Specialization;
  verifiedGrade: Grade | null;
  category?: string;
  skills: string[];
  demonstratedSkills: string[];
  testScore: number;
  industry?: string;
  bio?: string;
  achievements?: FspAchievement[];
  fspVerified?: boolean;
  contactUnlocked?: boolean;
}
export interface Recommendation extends MatchCandidate {
  category: string;
  score: number;
  achievementBonus: number;
  reasons: string[];
  gaps: string[];
  matchedSkills: string[];
  fspVerified: boolean;
  achievements: FspAchievement[];
  contactUnlocked: boolean;
  scoreBreakdown: { demonstratedSkills:number;testConfidence:number;context:number;declaredSkills:number;achievements:number };
}

const lexicon: {name:string;patterns:RegExp[]}[] = [
  {name:'JavaScript',patterns:[/\bjavascript\b/i,/\bjs\b/i,/джаваскрипт/i]},
  {name:'TypeScript',patterns:[/\btypescript\b/i,/\bts\b/i,/тайпскрипт/i]},
  {name:'Node.js',patterns:[/\bnode(?:\.js|js)?\b/i,/нод(?:а|е|у|js)\b/i]},
  {name:'SQL',patterns:[/\bsql\b/i,/\bpostgres(?:ql)?\b/i,/\bmysql\b/i,/реляционн/i]},
  {name:'HTTP',patterns:[/\bhttps?\b/i,/\brest(?:ful)?\b/i,/\bapi\b/i,/апи\b/i]},
  {name:'Git',patterns:[/\bgit\b/i,/\bgithub\b/i,/\bgitlab\b/i]},
  {name:'Algorithms',patterns:[/\balgorithms?\b/i,/алгоритм/i,/структур[аы] данных/i]},
  {name:'Security',patterns:[/\bsecurity\b/i,/\bxss\b/i,/\bcsrf\b/i,/безопасност/i,/авторизац/i,/аутентификац/i]},
  {name:'Architecture',patterns:[/\barchitecture\b/i,/архитектур/i,/\boutbox\b/i,/системн[а-я]* дизайн/i]},
  {name:'HTML',patterns:[/\bhtml(?:5)?\b/i,/семантическ[а-я]* верст/i,/семантическ[а-я]* вёрст/i]},
  {name:'CSS',patterns:[/\bcss(?:3)?\b/i,/\bgrid\b/i,/\bflex(?:box)?\b/i,/адаптивн[а-я]* верст/i,/адаптивн[а-я]* вёрст/i]},
  {name:'React',patterns:[/\breact(?:\.js|js)?\b/i,/реакт/i]},
  {name:'Async',patterns:[/\basync\b/i,/\bpromises?\b/i,/асинхрон/i]},
  {name:'Accessibility',patterns:[/\baccessibility\b/i,/\ba11y\b/i,/доступност[ьи]/i,/экранн[а-я]* диктор/i]},
  {name:'Testing',patterns:[/\btesting\b/i,/\btests?\b/i,/\bjest\b/i,/\bvitest\b/i,/тестирован/i,/тест[а-я]* интерфейс/i]},
  {name:'Python',patterns:[/\bpython\b/i,/питон/i]},
  {name:'Docker',patterns:[/\bdocker\b/i,/докер/i]},
  {name:'Redis',patterns:[/\bredis\b/i]},
  {name:'Vue',patterns:[/\bvue(?:\.js|js)?\b/i]},
];
export const skillCatalog = lexicon.map(entry=>entry.name);
export function extractDemandSkills(description: string): string[] {
  return lexicon.filter(entry=>entry.patterns.some(pattern=>pattern.test(description))).map(entry=>entry.name);
}
export function normalizeSkill(value:string):string {
  const text=value.trim();
  const exact=lexicon.find(entry=>entry.name.toLowerCase()===text.toLowerCase());
  if(exact) return exact.name;
  const inferred=extractDemandSkills(text);
  return inferred.length===1?inferred[0]:text;
}
function normalized(values:string[]|undefined):string[] { return [...new Set((values??[]).map(normalizeSkill).filter(Boolean))]; }
function fraction(overlap:string[],target:string[]):number { return target.length?overlap.length/target.length:1; }
function round(value:number):number { return Math.round(value*10)/10; }

const contexts:Record<string,string[]> = {
  fintech:['финтех','fintech','банк','платеж','платёж','финанс'],
  ecommerce:['ecommerce','e-commerce','ритейл','retail','магазин','торгов','каталог товар','маркетплейс'],
  education:['образован','education','edtech','обучен','курс','учеб'],
  health:['health','медицин','здоров','клиник'],
  gov:['govtech','госуслуг','государ','муницип'],
  media:['media','медиа','новост','контент','редакц'],
  hr:['hrtech','кадров','рекрут','ваканси','найм','карьер'],
  gaming:['gaming','игр','game'],
};
function contextIds(text:string):string[] {
  const lower=text.toLowerCase();
  return Object.entries(contexts).filter(([,words])=>words.some(word=>lower.includes(word))).map(([key])=>key);
}
function contextFit(candidate:MatchCandidate,demand:Demand):{score:number;description:string|null} {
  const requested=contextIds(`${demand.industry??''} ${demand.description} ${demand.title??''}`);
  const candidateContexts=contextIds(`${candidate.industry??''} ${candidate.bio??''} ${candidate.title}`);
  if(!requested.length) return {score:7.5,description:null};
  const shared=requested.filter(id=>candidateContexts.includes(id));
  return {score:15*fraction(shared,requested),description:shared.length?`Опыт в контексте потребности: ${shared.map(id=>contexts[id][0]).join(', ')}.`:null};
}
function achievementPoints(candidate:MatchCandidate,targetSkills:string[],now:Date):{score:number;relevant:FspAchievement[]} {
  if(!candidate.fspVerified) return {score:0,relevant:[]};
  const relevant=(candidate.achievements??[]).filter(achievement=>{
    if(!achievement.verified) return false;
    const skills=normalized(achievement.skills?.length?achievement.skills:extractDemandSkills(achievement.discipline));
    return targetSkills.length>0 && skills.some(skill=>targetSkills.includes(skill));
  });
  const score=relevant.reduce((sum,achievement)=>{
    const place=achievement.place;
    const performance=place===1?3:place!=null&&place<=3?2:place!=null&&place<=10?1.5:1;
    const date=Date.parse(achievement.date),age=(now.getTime()-date)/86400000;
    // Future/unknown dates receive no recency bonus; team result is labelled rather than treated as personal contribution.
    if(!Number.isFinite(age)||age<0) return sum;
    const recency=age<=365?1:age<=1095?0.75:0.5;
    return sum+performance*recency;
  },0);
  return {score:round(Math.min(MATCH_WEIGHTS.achievements,score)),relevant};
}

export function rankCandidates(candidates:MatchCandidate[],demand:Demand,options:{now?:Date|string}={}):Recommendation[] {
  if(!['backend','frontend'].includes(demand.specialization)||!['junior','middle'].includes(demand.grade)) return [];
  const required=normalized(demand.mustHave);
  const target=normalized([...demand.skills,...required,...extractDemandSkills(demand.description)]);
  const now=options.now instanceof Date?options.now:new Date(options.now??new Date().toISOString());
  return candidates.filter(candidate=>{
    if(candidate.specialization!==demand.specialization || candidate.verifiedGrade!==demand.grade) return false;
    const proven=normalized(candidate.demonstratedSkills);
    return required.every(skill=>proven.includes(skill));
  }).map(candidate=>{
    const proven=normalized(candidate.demonstratedSkills),declared=normalized(candidate.skills);
    const matchedSkills=target.filter(skill=>proven.includes(skill));
    const declaredMatch=target.filter(skill=>declared.includes(skill));
    const gaps=target.filter(skill=>!proven.includes(skill));
    const context=contextFit(candidate,demand);
    const achievement=achievementPoints(candidate,target,now);
    const scoreBreakdown={demonstratedSkills:round(55*fraction(matchedSkills,target)),testConfidence:round(20*Math.max(0,Math.min(100,candidate.testScore))/100),context:round(context.score),declaredSkills:round(5*fraction(declaredMatch,target)),achievements:achievement.score};
    const score=round(Object.values(scoreBreakdown).reduce((a,b)=>a+b,0));
    const reasons=[`Категория подтверждена: ${demand.specialization==='backend'?'Backend':'Frontend'} · ${demand.grade==='junior'?'Junior':'Middle'}.`,`Результат теста: ${candidate.testScore}/100.`];
    if(target.length) reasons.push(matchedSkills.length?`Подтверждено тестом ${matchedSkills.length} из ${target.length} компетенций: ${matchedSkills.join(', ')}.`:'В запросе нет компетенций, подтверждённых этим тестом.');
    else reasons.push('Конкретные компетенции не заданы; ранжирование основано на категории и результате проверки.');
    const declaredOnly=declaredMatch.filter(skill=>!proven.includes(skill));
    if(declaredOnly.length) reasons.push(`Только заявлены в резюме: ${declaredOnly.join(', ')}; они не заменяют результат теста.`);
    if(context.description) reasons.push(context.description);
    if(achievement.score>0) reasons.push(`Релевантные достижения ФСП: +${achievement.score} из максимум 5 баллов${achievement.relevant.some(a=>a.source==='mock-fsp')?' (демо-реестр)':''}.`);
    // Whitelisted DTO prevents accidental contact leakage even if callers pass a full profile.
    return {id:candidate.id,name:candidate.name,title:candidate.title,city:candidate.city,specialization:candidate.specialization,verifiedGrade:candidate.verifiedGrade,category:`${candidate.specialization==='backend'?'Backend':'Frontend'} · ${candidate.verifiedGrade==='junior'?'Junior':'Middle'}`,skills:declared,demonstratedSkills:proven,testScore:candidate.testScore,industry:candidate.industry,bio:candidate.bio,score,achievementBonus:achievement.score,reasons,gaps,matchedSkills,fspVerified:!!candidate.fspVerified,achievements:(candidate.achievements??[]).map(a=>({...a})),contactUnlocked:!!candidate.contactUnlocked,scoreBreakdown};
  }).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
}

/** Deliberately simple resume-stack baseline, without demonstrated competence weighting. */
export function stackBaseline(candidates:MatchCandidate[],demand:Demand):MatchCandidate[] {
  const target=normalized([...demand.skills,...demand.mustHave,...extractDemandSkills(demand.description)]);
  return candidates.filter(candidate=>candidate.specialization===demand.specialization && candidate.verifiedGrade===demand.grade).map(candidate=>({candidate,overlap:target.filter(skill=>normalized(candidate.skills).includes(skill)).length})).sort((a,b)=>b.overlap-a.overlap || a.candidate.id.localeCompare(b.candidate.id)).map(entry=>entry.candidate);
}
