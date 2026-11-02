import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

const app = express();
const port = process.env.PORT || 4000;
const cases = new Map();
const sessions = new Map();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
const safeCase = (item) => { const { solution, ...publicCase } = item; return publicCase; };

function makeDemoCase({ scenario, difficulty, title }) {
  const suspects = [
    { id:'mara', name:'Mara Voss', role:'Gallery curator', description:'Precise and responsible for the archive room.', motive:'A threatened career after a missing provenance file.', alibi:'Stayed in the front office until 21:20.' },
    { id:'eli', name:'Eli Rowan', role:'Night technician', description:'Knows every camera blind spot and service corridor.', motive:'Had access to the locked display case.', alibi:'Reset the east gallery sensors.' },
    { id:'nora', name:'Nora Bell', role:'Journalist', description:'Investigating the museum before its anniversary gala.', motive:'Wanted an exclusive story about the collection.', alibi:'Left the building at 20:55.' },
    { id:'samir', name:'Samir Holt', role:'Private collector', description:'A donor with a personal interest in one artifact.', motive:'The artifact would complete his private collection.', alibi:'Was on a call in the courtyard.' }
  ];
  const evidence = [
    { id:'ev-camera', title:'Camera 04 transcript', type:'CCTV', timestamp:'21:08', content:'At 21:08, the east gallery camera records a maintenance badge entering the service corridor. The badge leaves at 21:17.', relatedSuspectIds:['eli'] },
    { id:'ev-chat', title:'Unsent message', type:'Chat Messages', timestamp:'20:41', content:'“If the archive opens tonight, the missing page will tell them everything.” The draft is addressed to Mara but was never sent.', relatedSuspectIds:['mara','eli'] },
    { id:'ev-log', title:'Badge access log', type:'Documents', timestamp:'21:06', content:'Eli Rowan’s maintenance badge opened the archive corridor. No other badge was used between 20:50 and 21:30.', relatedSuspectIds:['eli'] },
    { id:'ev-witness', title:'Courtyard statement', type:'Witness Statements', timestamp:'21:12', content:'The security guard saw Samir in the courtyard during the camera outage, but could not see the east gallery.', relatedSuspectIds:['samir'] },
    { id:'ev-timeline', title:'Power fluctuation', type:'Timeline', timestamp:'21:05', content:'A brief power fluctuation reset the east gallery camera. The archive alarm remained active throughout.', relatedSuspectIds:['eli'] },
    { id:'ev-receipt', title:'Cafe receipt', type:'Call Logs', timestamp:'21:11', content:'Nora’s card was charged at a cafe two blocks away at 21:11.', relatedSuspectIds:['nora'] }
  ];
  return { id:randomUUID(), title:title || 'The Missing Lumen', scenario, difficulty, summary:'A priceless lens vanished during a gallery power fluctuation. Find the contradiction before the gala begins.', setting:'The Halcyon Museum, after closing', suspects, evidence, timeline:evidence.map((e,i)=>({ id:`t-${i}`, timestamp:e.timestamp, description:e.content, relatedEvidenceIds:[e.id] })), solution:{ culpritId:'eli', summary:'Eli used the maintenance badge and the camera reset to enter the archive.', reasoning:'The badge log, CCTV transcript, and power event align. The other alibis are supported by independent evidence.', keyEvidenceIds:['ev-camera','ev-log','ev-timeline'], redHerringExplanation:'The unsent message points toward Mara, but it was never sent and does not place her in the archive.' } };
}
app.get('/api/v1/health', (_req,res)=>res.json({ success:true, status:'ok', mode:'demo' }));
app.post('/api/v1/cases', (req,res)=>{ const { scenario, difficulty='medium', title }=req.body||{}; if(typeof scenario!=='string'||scenario.trim().length<50||scenario.trim().length>2000)return res.status(400).json({success:false,error:{code:'INVALID_SCENARIO',message:'Scenario must be between 50 and 2,000 characters.'}}); if(!['easy','medium','hard'].includes(difficulty))return res.status(400).json({success:false,error:{code:'INVALID_DIFFICULTY',message:'Choose easy, medium, or hard.'}}); const mystery=makeDemoCase({scenario:scenario.trim(),difficulty,title}); cases.set(mystery.id,mystery); const sessionId=randomUUID(); sessions.set(sessionId,{id:sessionId,caseId:mystery.id,status:'in_progress',startedAt:new Date().toISOString()}); res.status(201).json({success:true,case:safeCase(mystery),sessionId}); });
app.get('/api/v1/sessions/:sessionId',(req,res)=>{const session=sessions.get(req.params.sessionId), mystery=session&&cases.get(session.caseId); if(!session||!mystery)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Investigation session not found.'}});res.json({success:true,session,case:safeCase(mystery)});});
app.post('/api/v1/sessions/:sessionId/submit',(req,res)=>{const session=sessions.get(req.params.sessionId),mystery=session&&cases.get(session.caseId);if(!session||!mystery)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Investigation session not found.'}});if(session.status==='completed')return res.status(409).json({success:false,error:{code:'ALREADY_COMPLETED',message:'This investigation has already been submitted.'}});const selected=mystery.suspects.find(s=>s.id===req.body?.selectedSuspectId);if(!selected)return res.status(400).json({success:false,error:{code:'INVALID_SUSPECT',message:'Select a suspect from this case.'}});const correct=selected.id===mystery.solution.culpritId;Object.assign(session,{status:'completed',selectedSuspectId:selected.id,result:correct?'correct':'incorrect',score:correct?100:0,completedAt:new Date().toISOString()});res.json({success:true,result:{...session,selectedSuspect:selected,culprit:mystery.suspects.find(s=>s.id===mystery.solution.culpritId),solution:mystery.solution}});});
app.listen(port,()=>console.log(`AI Mystery Room API listening on ${port}`));
