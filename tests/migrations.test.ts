import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration=(name:string)=>readFileSync(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8');

test('additive release migration preserves existing profiles, session, category, test and application',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(migration('0000_loud_fat_cobra'));
    db.exec(migration('0001_outgoing_lester'));
    const now='2026-10-01T12:00:00.000Z';
    const user=db.prepare('INSERT INTO users(id,email,password_hash,password_salt,role,email_verified,consent_processing,created_at) VALUES(?,?,?,?,?,1,1,?)');
    user.run('candidate','candidate@fsp.invalid','password-hash','salt','candidate',now);
    user.run('employer','employer@fsp.invalid','password-hash','salt','employer',now);
    db.prepare("INSERT INTO profiles(id,name,title,phone,specialization,verified_grade,test_score,skills,updated_at) VALUES('candidate','Кандидат','Backend-разработчик','+70000001122','backend','junior',92,'[\"SQL\"]',?)").run(now);
    db.prepare("INSERT INTO profiles(id,name,company,updated_at) VALUES('employer','Компания','Демо',?)").run(now);
    db.prepare("INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES('session-hash','candidate',?,'2027-01-01T00:00:00.000Z')").run(now);
    db.prepare("INSERT INTO demands(id,employer_id,title,description,specialization,grade,skills,must_have,created_at) VALUES('demand','employer','Backend','SQL','backend','junior','[]','[]',?)").run(now);
    db.prepare("INSERT INTO vacancies(id,demand_id,employer_id,created_at) VALUES('vacancy','demand','employer',?)").run(now);
    db.prepare("INSERT INTO applications(id,vacancy_id,candidate_id,employer_id,created_at) VALUES('application','vacancy','candidate','employer',?)").run(now);
    db.prepare("INSERT INTO test_attempts(id,user_id,specialization,grade,exam_json,created_at,expires_at) VALUES('old-test','candidate','backend','junior','{}',?,'2027-01-01T00:00:00.000Z')").run(now);
    const oldProfile=db.prepare("SELECT * FROM profiles WHERE id='candidate'").get()!;
    const oldSession=db.prepare("SELECT * FROM sessions WHERE token_hash='session-hash'").get();
    const oldTest=db.prepare("SELECT * FROM test_attempts WHERE id='old-test'").get()!;
    db.exec(migration('0002_white_captain_marvel'));
    const profile=db.prepare("SELECT * FROM profiles WHERE id='candidate'").get()!;
    for(const [key,value] of Object.entries(oldProfile)) assert.equal(profile[key],value,key);
    assert.equal(profile.roles,'["Backend-разработчик"]');assert.equal(profile.soft_skills,'[]');
    assert.deepEqual(db.prepare("SELECT * FROM sessions WHERE token_hash='session-hash'").get(),oldSession);
    const attempt=db.prepare("SELECT * FROM test_attempts WHERE id='old-test'").get()!;
    for(const [key,value] of Object.entries(oldTest)) assert.equal(attempt[key],value,key);
    assert.equal(attempt.questionnaire_id,null);
    const application=db.prepare("SELECT * FROM applications WHERE id='application'").get()!;
    assert.equal(application.status,'sent');assert.equal(application.created_at,now);assert.equal(application.updated_at,now);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally { db.close(); }
});

test('fresh installation accepts linked questionnaires and defaults new profile and application fields',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON');
    for(const name of ['0000_loud_fat_cobra','0001_outgoing_lester','0002_white_captain_marvel']) db.exec(migration(name));
    db.exec("INSERT INTO users(id,email,password_hash,password_salt,role,created_at) VALUES('new','new@fsp.invalid','hash','salt','candidate','2026-10-11')");
    db.exec("INSERT INTO profiles(id,updated_at) VALUES('new','2026-10-11')");
    const profile=db.prepare("SELECT roles,soft_skills FROM profiles WHERE id='new'").get()!;
    assert.equal(profile.roles,'[]');assert.equal(profile.soft_skills,'[]');
    db.exec("INSERT INTO questionnaire_attempts(id,user_id,industry,specialization,claimed_grade,created_at) VALUES('survey','new','Образование','backend','junior','2026-10-11')");
    db.exec("INSERT INTO test_attempts(id,user_id,specialization,grade,questionnaire_id,exam_json,created_at,expires_at) VALUES('exam','new','backend','junior','survey','{}','2026-10-11','2026-10-12')");
    assert.equal(db.prepare("SELECT questionnaire_id FROM test_attempts WHERE id='exam'").get()!.questionnaire_id,'survey');
    assert.throws(()=>db.exec("INSERT INTO test_attempts(id,user_id,specialization,grade,questionnaire_id,exam_json,created_at,expires_at,submitted_at) VALUES('bad-exam','new','backend','junior','foreign-survey','{}','2026-10-11','2026-10-12','2026-10-11')"),/FOREIGN KEY/);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally { db.close(); }
});
