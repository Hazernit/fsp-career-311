import { authAction, confirmation } from '../../../lib/server/auth';
import { ApiError, demoMode, publicUser, requestJson, sessionUser } from '../../../lib/server/security';
import type { UserRow } from '../../../lib/server/security';
import { ownProfile, profileRow, publicCandidate } from '../../../lib/server/profiles';
import { linkFsp, unlinkFsp, updateProfile } from '../../../lib/server/profile-actions';
import { currentExam, startExam, submitExam, testHistory } from '../../../lib/server/exams';
import { applyVacancy, browseCandidates, createDemand, createInvitation, demandDetail, listDemands, listInvitations, listVacancies, matchDemand, publishVacancy, respondInvitation } from '../../../lib/server/hiring';
import { renderProfilePdf } from '../../../lib/server/pdf';
import { mockFspRegistry } from '../../../lib/domain/seed';
import { ALGORITHM_VERSION, skillCatalog } from '../../../lib/domain/matching';
import { TEST_VERSION } from '../../../lib/domain/tests';

export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200, sessionCookie?: string|string[]) {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if (sessionCookie) for (const value of (Array.isArray(sessionCookie) ? sessionCookie : [sessionCookie])) headers.append('Set-Cookie',value);
  return new Response(JSON.stringify({data}),{status,headers});
}
async function user(request: Request, role?: 'candidate'|'employer'): Promise<UserRow> { return (await sessionUser(request,true,role))!; }
async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  const body = method === 'GET' ? {} : await requestJson(request);
  if (method === 'GET' && path.join('/') === 'meta') return json({
    demoMode:demoMode(),algorithmVersion:ALGORITHM_VERSION,testVersion:TEST_VERSION,gradeChangeDays:90,durationSeconds:600,
    categories:[{id:'backend:junior',specialization:'backend',grade:'junior',label:'Backend · Junior'},{id:'backend:middle',specialization:'backend',grade:'middle',label:'Backend · Middle'},{id:'frontend:junior',specialization:'frontend',grade:'junior',label:'Frontend · Junior'},{id:'frontend:middle',specialization:'frontend',grade:'middle',label:'Frontend · Middle'}],
    skillCatalog,registryExamples:mockFspRegistry.map(entry=>({fspId:entry.fspId,proofCode:entry.proofCode,name:entry.participantName})),
    fspSource:'mock-fsp',mailMode:demoMode() ? 'demo-outbox' : 'resend',
  });
  if (method === 'GET' && path.join('/') === 'session') return json({user:await sessionUser(request,false,undefined,false).then(u=>u ? publicUser(u) : null)});
  if (method === 'GET' && path.join('/') === 'auth/confirmation') return json(await confirmation(request));
  if (method === 'POST' && path[0] === 'auth' && path.length === 2) {
    const result = await authAction(path[1],body,request);
    return json(result.data,200,result.cookie);
  }
  if (path.join('/') === 'profile' && method === 'GET') {
    const current = await user(request);
    return json(ownProfile(await profileRow(current.id),current));
  }
  if (path.join('/') === 'profile' && method === 'PATCH') return json(await updateProfile(await user(request),body));
  if (path.join('/') === 'profile/pdf' && method === 'GET') {
    const current = await user(request,'candidate');
    const profile = ownProfile(await profileRow(current.id),current);
    const history = await testHistory(current);
    const bytes = await renderProfilePdf({...profile,history},{email:current.email,phone:'phone' in profile ? profile.phone as string : undefined});
    return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="fsp-profile.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if (path.join('/') === 'fsp/link' && method === 'POST') return json(await linkFsp(await user(request,'candidate'),body));
  if (path.join('/') === 'fsp/unlink' && method === 'POST') return json(await unlinkFsp(await user(request,'candidate')));
  if (path.join('/') === 'tests/start' && method === 'POST') return json(await startExam(await user(request,'candidate'),body));
  if (path.join('/') === 'tests/current' && method === 'GET') return json(await currentExam(await user(request,'candidate')));
  if (path.join('/') === 'tests/history' && method === 'GET') return json(await testHistory(await user(request,'candidate')));
  if (path[0] === 'tests' && path[2] === 'submit' && path.length === 3 && method === 'POST') return json(await submitExam(await user(request,'candidate'),path[1],body));
  if (path.join('/') === 'demands' && method === 'GET') return json(await listDemands(await user(request,'employer')));
  if (path.join('/') === 'demands' && method === 'POST') return json(await createDemand(await user(request,'employer'),body),201);
  if (path[0] === 'demands' && path.length === 2 && method === 'GET') return json(await demandDetail(await user(request,'employer'),path[1]));
  if (path[0] === 'demands' && path[2] === 'match' && path.length === 3 && method === 'POST') return json(await matchDemand(await user(request,'employer'),path[1]));
  if (path.join('/') === 'candidates' && method === 'GET') return json(await browseCandidates(await user(request,'employer'),url.searchParams));
  if (path[0] === 'candidates' && path.length === 2 && method === 'GET') return json(await publicCandidate(path[1],(await user(request,'employer')).id));
  if (path[0] === 'candidates' && path[2] === 'pdf' && path.length === 3 && method === 'GET') {
    const profile = await publicCandidate(path[1],(await user(request,'employer')).id);
    const bytes = await renderProfilePdf(profile,profile.contacts);
    return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="fsp-candidate.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if (path.join('/') === 'invitations' && method === 'GET') return json(await listInvitations(await user(request)));
  if (path.join('/') === 'invitations' && method === 'POST') return json(await createInvitation(await user(request,'employer'),body),201);
  if (path[0] === 'invitations' && path[2] === 'respond' && path.length === 3 && method === 'POST') return json(await respondInvitation(await user(request,'candidate'),path[1],body));
  if (path.join('/') === 'vacancies' && method === 'GET') return json(await listVacancies(await user(request)));
  if (path.join('/') === 'vacancies' && method === 'POST') return json(await publishVacancy(await user(request,'employer'),body),201);
  if (path[0] === 'vacancies' && path[2] === 'apply' && path.length === 3 && method === 'POST') return json(await applyVacancy(await user(request,'candidate'),path[1]));
  throw new ApiError(404,'NOT_FOUND','Метод не найден.');
}
async function handler(request: Request): Promise<Response> {
  try { return await dispatch(request); }
  catch (error) {
    if (error instanceof ApiError) return new Response(JSON.stringify({error:{code:error.code,message:error.message}}),{status:error.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    // Do not return SQL errors, stack traces, tokens or deployment credentials to callers.
    console.error('API request failed',error instanceof Error ? error.message : 'unknown');
    return new Response(JSON.stringify({error:{code:'INTERNAL_ERROR',message:'Не удалось выполнить запрос. Попробуйте ещё раз.'}}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  }
}
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
