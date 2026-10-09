import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExam, evaluateExam, publicExam, canStartExam, assessmentCategories } from '../lib/domain/tests.ts';
import { rankCandidates, extractDemandSkills, normalizeSkill } from '../lib/domain/matching.ts';
import { syntheticCandidates } from '../lib/domain/seed.ts';

const categories=assessmentCategories;
test('4000 reproducible variants have unique options, identical blueprints and private keys',()=>{
  for(const category of categories) {
    const fingerprints=new Set<string>();
    const reference=generateExam({...category,seed:'reference'});
    const coverage=reference.questions.map(q=>q.family).sort();
    for(let seed=0;seed<1000;seed++) {
      const exam=generateExam({...category,seed:String(seed)});
      assert.deepEqual(exam,generateExam({...category,seed:String(seed)}));
      assert.equal(exam.questions.length,12);
      assert.deepEqual(exam.questions.map(q=>q.family).sort(),coverage);
      assert.equal(new Set(exam.questions.map(q=>q.id)).size,12);
      for(const question of exam.questions) {
        assert.equal(question.options.length,4);
        assert.equal(new Set(question.options.map(o=>o.text)).size,4);
        assert(question.options.some(o=>o.id===exam.answerKey[question.id].optionId));
      }
      const answers=Object.fromEntries(Object.entries(exam.answerKey).map(([id,answer])=>[id,answer.optionId]));
      const result=evaluateExam(exam,answers);
      assert.equal(result.score,100);assert.equal(result.passed,true);assert.equal(result.demonstratedSkills.length,6);
      assert.equal(evaluateExam(exam,{}).passed,false);
      assert.equal(evaluateExam(exam,Object.fromEntries(exam.questions.map(q=>[q.id,'invalid']))).correct,0);
      const safe=publicExam(exam);
      assert.equal('answerKey' in safe,false);assert.equal('seed' in safe,false);
      fingerprints.add(JSON.stringify(safe.questions));
    }
    assert.equal(fingerprints.size,1000);
  }
});

test('numeric family answers agree with independent calculations from the displayed problem',()=>{
  for(const category of categories) for(let seed=0;seed<100;seed++) {
    const exam=generateExam({...category,seed:`numerical-${seed}`});
    for(const q of exam.questions) {
      const actual=q.options.find(o=>o.id===exam.answerKey[q.id].optionId)!.text;
      const prompt=q.prompt;
      if(['python-comprehension-sum','js-array-pipeline'].includes(q.family)) {
        const numbers=prompt.match(/\[([\d, ]+)\]/)![1].split(',').map(Number);
        const multiplier=Number(prompt.match(/\* (\d+)/)![1]);
        assert.equal(Number(actual),numbers.reduce((sum,value)=>sum+(value%2===0?value*multiplier:0),0));
      }
      if(q.family==='sql-filter-sum') {
        const paid=[...prompt.matchAll(/\((\d+), 'paid'\)/g)].map(m=>Number(m[1]));
        assert.equal(Number(actual),paid.reduce((sum,value)=>sum+value,0));
      }
      if(q.family==='sql-left-join-null') {
        const users=Number(prompt.match(/есть (\d+) строк/)![1]);
        const orders=Number(prompt.match(/У (\d+) разных/)![1]);
        assert.equal(Number(actual),users-orders);
      }
      if(q.family==='algorithm-halving') {
        let size=Number(prompt.match(/из (\d+) элементов/)![1]),steps=0;
        while(size>1){size/=2;steps++;}assert.equal(Number(actual),steps);
      }
      if(q.family==='css-content-box-width') {
        const width=Number(prompt.match(/width: (\d+)px/)![1]),padding=Number(prompt.match(/padding: (\d+)px/)![1]),border=Number(prompt.match(/border: (\d+)px/)![1]);
        assert.equal(actual,`${width+padding+padding+border+border}px`);
      }
      if(['js-closure-state','python-nonlocal-closure'].includes(q.family)) {
        const initial=Number(prompt.match(/value = (\d+)/)![1]),increment=Number(prompt.match(/value \+= (\d+)/)![1]);
        let state=initial;state+=increment;state+=increment;assert.equal(Number(actual),state);
      }
      if(q.family==='react-functional-state') {
        const initial=Number(prompt.match(/count = (\d+)/)![1]),increment=Number(prompt.match(/c \+ (\d+)/)![1]);
        assert.equal(Number(actual),[increment,increment].reduce((state,value)=>state+value,initial));
      }
      if(q.family==='python-mutable-default') {
        const values=[...prompt.matchAll(/collect\((\d+)\)/g)].map(m=>Number(m[1]));
        assert.equal(actual,`[${values.join(', ')}]`);
      }
      if(q.family==='python-runtime-type-hints') {
        const values=prompt.match(/add\('(\d+)', '(\d+)'\)/)!;
        assert.equal(actual,`Выведет строку '${values[1]}${values[2]}'`);
      }
      if(q.family==='testing-inclusive-boundaries') {
        const bounds=prompt.match(/\[(\d+), (\d+)\]/)!;
        const min=Number(bounds[1]),max=Number(bounds[2]);assert.equal(actual,`${min-1}, ${min}, ${max}, ${max+1}`);
      }
    }
  }
});

test('75% threshold also requires coverage; no automatic downgrade or demonstrated guesses',()=>{
  for(const category of categories) {
    const exam=generateExam({...category,seed:'coverage'});
    const perfect=Object.fromEntries(Object.entries(exam.answerKey).map(([id,a])=>[id,a.optionId]));
    const skills=[...new Set(exam.questions.map(q=>q.skill))];
    const noSkill={...perfect};
    for(const q of exam.questions.filter(q=>q.skill===skills[0])) delete noSkill[q.id];
    const result=evaluateExam(exam,noSkill);
    assert.equal(result.score,83);assert.equal(result.passed,false);
    assert(!result.demonstratedSkills.includes(skills[0]));
    assert.equal('verifiedGrade' in result,false);
    const borderline={...perfect};
    for(const skill of skills.slice(0,3)) delete borderline[exam.questions.find(q=>q.skill===skill)!.id];
    assert.equal(evaluateExam(exam,borderline).score,75);assert.equal(evaluateExam(exam,borderline).passed,true);
    assert.equal(evaluateExam(exam,borderline).demonstratedSkills.length,3);
  }
});

test('initial lower-level attempt free; confirmed category changes need90days',()=>{
  assert.equal(canStartExam({specialization:'backend',grade:'junior'}).allowed,true);
  const state={verifiedSpecialization:'backend' as const,verifiedGrade:'junior' as const,lastVerifiedAt:'2026-10-01T00:00:00.000Z',now:'2026-10-10T00:00:00.000Z'};
  assert.equal(canStartExam({...state,specialization:'backend',grade:'junior'}).allowed,true);
  assert.equal(canStartExam({...state,specialization:'backend',grade:'middle'}).allowed,false);
  assert.equal(canStartExam({...state,specialization:'frontend',grade:'junior'}).allowed,false);
  assert.equal(canStartExam({...state,specialization:'backend',grade:'middle',now:'2026-12-30T00:00:00.000Z'}).allowed,true);
});

test('hard category, demonstrated mandatory requirements and capped relevant achievements',()=>{
  const candidate=syntheticCandidates[0];
  const demand={description:'Python, SQL, API',specialization:'backend' as const,grade:'junior' as const,skills:['Python','SQL','HTTP'],mustHave:[]};
  const unconfirmed={...candidate,id:'unconfirmed',verifiedGrade:null,fspVerified:true,achievements:[{id:'a',event:'test',discipline:'SQL',date:'2026-01-01',result:'1',place:1,source:'mock-fsp' as const,verified:true,skills:['SQL']}]};
  const wrongGrade={...candidate,id:'middle',verifiedGrade:'middle' as const};
  assert.equal(rankCandidates([unconfirmed,wrongGrade],demand).length,0);
  assert.equal(rankCandidates([candidate],{...demand,mustHave:['SQL']}).length,0);
  const strong=syntheticCandidates[5];
  const enhanced={...strong,fspVerified:true,achievements:Array.from({length:100},(_,index)=>({...unconfirmed.achievements[0],id:String(index)}))};
  const ranked=rankCandidates([enhanced],demand,{now:'2026-10-10'});
  assert.equal(ranked[0].achievementBonus,5);assert(ranked[0].score<=100);
  const unrelated=rankCandidates([{...enhanced,achievements:enhanced.achievements.map(a=>({...a,skills:['React']}))}],demand,{now:'2026-10-10'});
  assert.equal(unrelated[0].achievementBonus,0);
  const unverified=rankCandidates([{...enhanced,achievements:enhanced.achievements.map(a=>({...a,verified:false}))}],demand,{now:'2026-10-10'});
  assert.equal(unverified[0].achievementBonus,0);
  const privateInput={...strong,email:'secret@private.example',phone:'+79999999999'};
  const output=JSON.stringify(rankCandidates([privateInput],demand));assert(!output.includes('secret@private'));assert(!output.includes('+79999999999'));
});

test('Russian and English demand lexicon is deterministic and unknown skills stay explicit',()=>{
  assert.deepEqual(extractDemandSkills('Python разработчик, SQL, REST API и безопасность'),['SQL','HTTP','Security','Python']);
  assert.equal(normalizeSkill('postgresql'),'SQL');assert.equal(normalizeSkill('  Kubernetes  '),'Kubernetes');
  assert.deepEqual(extractDemandSkills('React + TypeScript, адаптивная вёрстка, a11y'),['TypeScript','CSS','React','Accessibility']);
});

test('synthetic demonstrated skills belong to their category blueprint; scores physically possible',()=>{
  for(const candidate of syntheticCandidates) {
    const exam=generateExam({specialization:candidate.specialization,grade:candidate.verifiedGrade!,seed:'seed-consistency'});
    const available=new Set(exam.questions.map(q=>q.skill));
    assert(candidate.demonstratedSkills.every(skill=>available.has(skill)));
    assert.equal(candidate.testScore,Math.round((6+candidate.demonstratedSkills.length)/12*100));
  }
});
