import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { rankCandidates, stackBaseline, ALGORITHM_VERSION, MATCH_WEIGHTS } from '../lib/domain/matching.ts';
import type { Demand } from '../lib/domain/matching.ts';
import { syntheticCandidates, SEED_VERSION } from '../lib/domain/seed.ts';
import { generateExam, evaluateExam, seededRandom, assessmentCategories, TEST_VERSION } from '../lib/domain/tests.ts';

const workspace=resolve(import.meta.dirname,'..');
const fixture=JSON.parse(readFileSync(resolve(import.meta.dirname,'../tests/matching-holdout.json'),'utf8')) as {version:string;protocol:string;queries:{id:string;demand:Demand;labels:Record<string,number>}[]};
function precision(ids:string[],labels:Record<string,number>,k=5):number {return ids.slice(0,k).filter(id=>(labels[id]??0)>=2).length/k;}
function dcg(labels:number[]):number {return labels.reduce((sum,label,index)=>sum+(2**label-1)/Math.log2(index+2),0);}
function ndcg(ids:string[],labels:Record<string,number>,k=5):number {
  const ideal=dcg(Object.values(labels).sort((a,b)=>b-a).slice(0,k));
  return ideal?dcg(ids.slice(0,k).map(id=>labels[id]??0))/ideal:0;
}
function mean(values:number[]):number{return values.reduce((a,b)=>a+b,0)/values.length;}
function round(value:number):number{return Math.round(value*10000)/10000;}
const matchingQueries=fixture.queries.map(query=>{
  const ranked=rankCandidates(syntheticCandidates,query.demand,{now:'2026-10-10T00:00:00.000Z'}).map(candidate=>candidate.id);
  const baseline=stackBaseline(syntheticCandidates,query.demand).map(candidate=>candidate.id);
  return {id:query.id,ranked:ranked.slice(0,5),baseline:baseline.slice(0,5),evidence:{precisionAt5:precision(ranked,query.labels),ndcgAt5:round(ndcg(ranked,query.labels))},stack:{precisionAt5:precision(baseline,query.labels),ndcgAt5:round(ndcg(baseline,query.labels))}};
});

// Equivalent-variant simulation: stable latent competency per synthetic profile, random response noise.
// Same abilities on independently seeded exam variants; this is a simulation, not empirical calibration.
const abilityProfiles=[{name:'weak',probability:0.28},{name:'borderline',probability:0.7},{name:'strong',probability:0.95}];
const simulation=[];
for(const category of assessmentCategories) for(const ability of abilityProfiles) {
  let stable=0,passA=0,passB=0;
  const matrix:{[key:string]:number}={'fail→fail':0,'fail→pass':0,'pass→fail':0,'pass→pass':0};
  for(let person=0;person<100;person++) {
    const outcomes=[];
    for(const variant of ['A','B']) {
      const exam=generateExam({...category,seed:`simulation-${ability.name}-${person}-${variant}`});
      const rng=seededRandom(`response-${category.specialization}-${category.grade}-${ability.name}-${person}-${variant}`);
      const answers=Object.fromEntries(exam.questions.map(question=>{
        const reference=exam.answerKey[question.id].optionId;
        const wrong=question.options.filter(option=>option.id!==reference);
        return [question.id,rng()<ability.probability?reference:wrong[Math.floor(rng()*wrong.length)].id];
      }));
      outcomes.push(evaluateExam(exam,answers).passed);
    }
    if(outcomes[0]===outcomes[1])stable++;
    if(outcomes[0])passA++;if(outcomes[1])passB++;
    matrix[`${outcomes[0]?'pass':'fail'}→${outcomes[1]?'pass':'fail'}`]++;
  }
  simulation.push({category:category.category,ability:ability.name,correctAnswerProbability:ability.probability,profiles:100,agreement:stable/100,passRateA:passA/100,passRateB:passB/100,matrix});
}
const report={
  generatedAt:new Date().toISOString(),algorithmVersion:ALGORITHM_VERSION,testVersion:TEST_VERSION,seedVersion:SEED_VERSION,weights:MATCH_WEIGHTS,
  matching:{fixtureVersion:fixture.version,protocol:fixture.protocol,queries:matchingQueries.length,candidates:syntheticCandidates.length,positiveRelevance:'label ≥ 2',k:5,precisionDenominator:5,evidence:{precisionAt5:round(mean(matchingQueries.map(query=>query.evidence.precisionAt5))),ndcgAt5:round(mean(matchingQueries.map(query=>query.evidence.ndcgAt5)))},stackBaseline:{precisionAt5:round(mean(matchingQueries.map(query=>query.stack.precisionAt5))),ndcgAt5:round(mean(matchingQueries.map(query=>query.stack.ndcgAt5)))},details:matchingQueries},
  assessment:{variantsChecked:4000,questionInstancesChecked:48000,blueprint:{questions:12,competencies:6,questionsPerCompetency:2,threshold:75,minEveryCompetency:50,demonstratedCompetency:100,durationSeconds:600},simulation:{profiles:1200,attempts:2400,overallAgreement:round(mean(simulation.map(row=>row.agreement))),details:simulation,limitations:'Bernoulli simulation with assumed ability levels. Does not establish psychometric validity, real-human test-retest reliability, anti-cheat effectiveness, hiring outcomes or fairness. Near-threshold instability is expected for a short12itemassessment.'}},
  limitations:['Synthetic records and editorial relevance labels; no real candidates or hiring outcomes.','Hold-out demands and labels were not used to select or optimize weights. Profiles overlap UI demonstration dataset; external expert replication is required.','No statistical confidence claim from eight synthetic demands.','Controlled parameters preserve coverage and task operations, not empirically calibrated item difficulty.','Multiple-choice format does not demonstrate ability to build production software.'],
};
const output=resolve(workspace,'docs/validation-results.json');mkdirSync(resolve(workspace,'docs'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,matching:report.matching.evidence,baseline:report.matching.stackBaseline,testRetestAgreement:report.assessment.simulation.overallAgreement,limitations:report.limitations},null,2));
