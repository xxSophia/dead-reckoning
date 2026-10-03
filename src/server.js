const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const path=require('path');
const QR=require('./qr');
const {STATIONS,ACTIONS,dailySeed,initialState,reduce,hashSeed}=require('./game');

const app=express(),server=http.createServer(app),io=new Server(server,{pingTimeout:20000,pingInterval:10000,maxHttpBufferSize:10000});
const rooms=new Map(),leaders=[];
app.use(express.static(path.join(__dirname,'../public')));
app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size,uptime:Math.round(process.uptime())}));
app.get('/api/leaderboard',(_,res)=>res.json(leaders.slice(0,10)));
app.get('/api/qr',async(req,res)=>{try{const c=cleanCode(req.query.room);if(c.length!==4)return res.status(400).end();const base=`${req.protocol}://${req.get('host')}`;const svg=QR.svg(`${base}/?room=${c}`);res.type('image/svg+xml').send(svg)}catch{res.status(500).end()}});

const cleanNick=s=>String(s||'').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18);
const cleanCode=s=>String(s||'').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,4);
const cleanChat=s=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,120);
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ';
function makeCode(){let c;do{c='';for(let i=0;i<4;i++)c+=ALPHA[crypto.randomInt(ALPHA.length)]}while(rooms.has(c));return c}
function player(r,token){return r.players.find(p=>p.token===token)}
function corrupt(text){const swaps=[['SEAL','VENT'],['VENT','SEAL'],['PORT','STARBOARD'],['STARBOARD','PORT'],['SLOW','BOOST'],['BOOST','SLOW'],['DIVE','SURFACE'],['SURFACE','DIVE'],['COOL','BOOST'],['PING','VENT']];for(const [a,b] of swaps)if(text.includes(a))return text.replace(a,b)+' [SIGNAL DRIFT]';return text+' [SIGNAL DRIFT]'}
function publicRoom(r,token){
  const me=player(r,token),round=r.state.round;
  const safeState={seed:r.state.seed,depth:r.state.depth,hull:r.state.hull,status:r.state.status,history:r.state.history.map(x=>({depth:x.depth,ok:x.ok})),startedAt:r.state.startedAt,deadline:r.state.deadline,round:null};
  if(round){let clue=me?.station?round.clues[me.station]:null;if(me?.station===round.offlineStation)clue=null;else if(clue&&me?.station===round.relayStation)clue={...clue,text:`${clue.text} | RELAY/${round.offlineStation}: ${round.clues[round.offlineStation].text}`};if(clue&&me?.saboteur)clue={...clue,text:corrupt(clue.text),reliable:false};safeState.round={id:round.id,name:round.name,icon:round.icon,description:round.description,clue:clue?{text:clue.text,reliable:clue.reliable}:null,requiredActions:round.solution.length,offlineStation:round.offlineStation}}
  return{code:r.code,host:r.host,settings:r.settings,state:safeState,phase:r.phase,players:r.players.map(p=>({nick:p.nick,station:p.station,online:p.online,bot:p.bot,host:p.token===r.host})),me:me?{nick:me.nick,station:me.station,token:me.token,saboteur:!!me.saboteur}:null,chat:r.chat.slice(-40),votes:r.phase==='vote'?{cast:Object.keys(r.votes).length,total:r.players.filter(p=>!p.bot).length}:null,stats:r.state.status==='won'||r.state.status==='lost'?r.stats:null}
}
function emit(r){for(const p of r.players.filter(x=>x.online&&!x.bot&&x.socket))io.to(p.socket).emit('state',publicRoom(r,p.token))}
function addBot(r,station){r.players.push({token:'bot-'+crypto.randomUUID(),nick:['Mako','Iris','Keel','Rook','Nemo','Vega'][STATIONS.indexOf(station)],station,bot:true,online:true,stats:{pings:0,relays:0,firstRelay:null}})}
function prepareCrew(r){const humans=r.players.filter(p=>!p.bot);if(humans.length<2){for(const station of STATIONS)if(!r.players.some(p=>p.station===station))addBot(r,station)}if(r.settings.saboteur&&!r.players.some(p=>p.saboteur)){const pool=humans.length?humans:r.players;pool[hashSeed(r.state.seed)%pool.length].saboteur=true}}
function botRelays(r){if(r.state.status!=='playing'||r.phase!=='crisis')return;const sources=[...r.players.filter(p=>p.bot),...r.players.filter(p=>!p.bot&&!p.online)];sources.forEach((b,i)=>setTimeout(()=>{if(r.state.status!=='playing'||r.phase!=='crisis')return;let clue=r.state.round?.clues[b.station]?.text;if(b.station===r.state.round?.offlineStation)return;if(b.station===r.state.round?.relayStation)clue+=` | RELAY/${r.state.round.offlineStation}: ${r.state.round.clues[r.state.round.offlineStation].text}`;if(!clue)return;const imperfect=((hashSeed(r.state.round.id+b.station)%10)<2)?'Signal uncertain. ':'';r.chat.push({from:b.bot?b.nick:`AUTO/${b.station}`,text:`${imperfect}${clue}`,bot:true,t:Date.now()});emit(r)},650+i*500))}
function setDeadline(r){
  const tutorialDepth = r.state.depth === 1;
  const ms = tutorialDepth
    ? 120000
    : r.settings.team
      ? 65000
      : Math.max(24000, 47000 - r.state.depth * 1700);

  r.state.deadline = Date.now() + ms;
}
function computeStats(r){const humans=r.players.filter(p=>!p.bot);const byPings=[...humans].sort((a,b)=>b.stats.pings-a.stats.pings);const byRelays=[...humans].sort((a,b)=>b.stats.relays-a.stats.relays);const misses=r.state.history.filter(x=>!x.ok).length;return{awards:[{label:'Best relay',nick:byRelays[0]?.nick||'Crew',value:`${byRelays[0]?.stats.relays||0} relays`},{label:'Most pings',nick:byPings[0]?.nick||'Crew',value:`${byPings[0]?.stats.pings||0} pings`},{label:'Saved the hull',nick:humans[0]?.nick||'Crew',value:`${r.state.hull}% integrity`}],debrief:misses?`The crew solved ${r.state.history.length-misses} crises cleanly and misread ${misses}. Improve by confirming the full action order before committing, especially after comms jam.`:`The crew maintained clean relay discipline with no wrong commits. Next dive, shorten the gap between matching signals and commitment.`,voteResult:r.lastVoteResult||null}}
function finish(r){if(!['won','lost'].includes(r.state.status))return;r.phase='ended';r.stats=computeStats(r);if(r.settings.daily){leaders.push({crew:r.players.filter(p=>!p.bot).map(p=>p.nick).join('+')||'Solo',score:r.state.depth*100+r.state.hull,depth:r.state.depth,at:Date.now()});leaders.sort((a,b)=>b.score-a.score||a.at-b.at);leaders.splice(20)}emit(r)}
function endVote(r){
  if(r.phase!=='vote')return;

  const tally={};
  Object.values(r.votes).forEach(n=>{
    tally[n]=(tally[n]||0)+1;
  });

  const top=Object.entries(tally)
    .sort((a,b)=>b[1]-a[1])[0];

  const sab=r.players.find(p=>p.saboteur);
  const correct=!!(top&&sab&&top[0]===sab.nick);

  if(top){
    if(correct){
      const before=r.state.hull;
      r.state.hull=Math.min(100,r.state.hull+10);
      const repaired=r.state.hull-before;

      r.lastVoteResult=
        `SUSPICION CONFIRMED — ${top[0]}'s signal was compromised. `+
        (repaired>0
          ? `Emergency repair awarded: +${repaired}% hull.`
          : `Hull already at maximum integrity.`);
    }else{
      r.lastVoteResult=
        `FALSE ALARM — ${top[0]}'s signal was clean. No repair awarded.`;
    }
  }else{
    r.lastVoteResult='NO VERDICT — no suspicion vote was cast.';
  }

  r.votes={};

  if(['won','lost'].includes(r.state.status)){
    return finish(r);
  }

  r.phase='crisis';
  setDeadline(r);

  r.chat.push({
    from:'SYSTEM',
    text:`Vote closed. ${r.lastVoteResult} Next depth beginning.`,
    t:Date.now()
  });

  emit(r);
  botRelays(r);
}

function beginVote(r){r.phase='vote';r.state.deadline=null;r.votes={};r.chat.push({from:'SYSTEM',text:'Depth secured. Saboteur protocol: vote for the crew member whose intel seemed compromised.',t:Date.now()});emit(r);r.voteTimer=setTimeout(()=>endVote(r),10000)}

io.on('connection',socket=>{
 socket.on('create',(raw={},ack=()=>{})=>{try{const nick=cleanNick(raw.nick)||'Diver',c=makeCode(),token=crypto.randomUUID(),settings={saboteur:!!raw.saboteur,team:!!raw.team,daily:!!raw.daily};const seed=settings.daily?dailySeed():String(raw.seed||crypto.randomBytes(3).toString('hex')).slice(0,32);const r={code:c,host:token,settings,state:initialState(seed,settings.team),phase:'lobby',players:[{token,nick,station:'Sonar',socket:socket.id,online:true,bot:false,saboteur:false,stats:{pings:0,relays:0,firstRelay:null}}],chat:[],votes:{},createdAt:Date.now(),lastSubmitAt:0};rooms.set(c,r);socket.join(c);ack({ok:true,code:c,token});emit(r)}catch{ack({ok:false,error:'Could not create room.'})}});
 socket.on('join',(raw={},ack=()=>{})=>{try{const c=cleanCode(raw.code),r=rooms.get(c);if(c.length!==4||!r)return ack({ok:false,error:'That room code is not active. Check the four letters and try again.'});let p=player(r,raw.token),nick=cleanNick(raw.nick)||'Diver';if(!p&&r.players.some(x=>!x.bot&&x.nick.toLowerCase()===nick.toLowerCase()))return ack({ok:false,error:'That callsign is already aboard. Choose another.'});if(!p){if(r.state.status!=='lobby')return ack({ok:false,error:'Dive already underway. Rejoin with your original browser or create a new crew.'});const station=STATIONS.find(s=>!r.players.some(x=>x.station===s&&!x.bot));if(!station)return ack({ok:false,error:'Crew is full.'});p={token:crypto.randomUUID(),nick,station,socket:socket.id,online:true,bot:false,saboteur:false,stats:{pings:0,relays:0,firstRelay:null}};r.players.push(p)}else{p.socket=socket.id;p.online=true}socket.join(c);ack({ok:true,code:c,token:p.token});emit(r)}catch{ack({ok:false,error:'Could not join room.'})}});
 socket.on('settings',(raw={},ack=()=>{})=>{const r=rooms.get(cleanCode(raw.code));if(!r||r.host!==raw.token||r.state.status!=='lobby')return ack({ok:false,error:'Only the host can change lobby settings.'});r.settings={saboteur:!!raw.saboteur,team:!!raw.team,daily:!!raw.daily};r.state=initialState(r.settings.daily?dailySeed():r.state.seed.replace(/^DAILY-.*/,crypto.randomBytes(3).toString('hex')),r.settings.team);emit(r);ack({ok:true})});
 socket.on('start',(raw={},ack=()=>{})=>{const r=rooms.get(cleanCode(raw.code));if(!r||r.host!==raw.token)return ack({ok:false,error:'Only the host can dive.'});if(r.state.status!=='lobby')return ack({ok:false,error:'Dive already started.'});prepareCrew(r);r.state=reduce(r.state,{type:'START'});r.phase='crisis';setDeadline(r);r.chat.push({from:'SYSTEM',text:'Dive commenced. Relay fragments, compare static, then commit the exact action order.',t:Date.now()});emit(r);botRelays(r);ack({ok:true})});
 socket.on('submit',(raw={},ack=()=>{})=>{const r=rooms.get(cleanCode(raw.code)),p=r&&player(r,raw.token);if(!r||!p||r.state.status!=='playing'||r.phase!=='crisis')return ack({ok:false,error:'No active crisis to commit.'});if(Date.now()-r.lastSubmitAt<700)return ack({ok:false,error:'Commit already received. Stand by.'});const acts=Array.isArray(raw.actions)?raw.actions.map(x=>String(x)).filter(a=>ACTIONS.includes(a)).slice(0,3):[];if(!acts.length)return ack({ok:false,error:'Choose an action first.'});r.lastSubmitAt=Date.now();r.state=reduce(r.state,{type:'SUBMIT',actions:acts});r.chat.push({from:'SYSTEM',text:r.state.history.at(-1).ok?'Sequence accepted. Depth secured.':'Wrong sequence. Hull integrity reduced.',t:Date.now()});if(r.settings.saboteur)beginVote(r);else if(['won','lost'].includes(r.state.status))finish(r);else{r.phase='crisis';setDeadline(r);emit(r);botRelays(r)}ack({ok:true})});
 socket.on('vote',(raw={},ack=()=>{})=>{const r=rooms.get(cleanCode(raw.code)),p=r&&player(r,raw.token);if(!r||!p||p.bot||r.phase!=='vote')return ack({ok:false,error:'Voting is not open.'});const target=cleanNick(raw.nick);if(!r.players.some(x=>!x.bot&&x.nick===target))return ack({ok:false,error:'Choose a crew member.'});r.votes[p.token]=target;emit(r);if(Object.keys(r.votes).length>=r.players.filter(x=>!x.bot&&x.online).length){clearTimeout(r.voteTimer);endVote(r)}ack({ok:true})});
 socket.on('chat',(raw={})=>{const r=rooms.get(cleanCode(raw.code)),p=r&&player(r,raw.token);if(!r||!p||r.phase!=='crisis')return;const text=cleanChat(raw.text);if(!text)return;if(r.state.depth>3&&!text.startsWith('PING:'))return socket.emit('toast','Comms jammed: use tactical pings.');if(text.startsWith('PING:'))p.stats.pings++;else p.stats.relays++;if(!p.stats.firstRelay)p.stats.firstRelay=Date.now();r.chat.push({from:p.nick,text,t:Date.now()});emit(r)});
 socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.find(x=>x.socket===socket.id);if(!p)continue;p.online=false;p.socket=null;if(r.host===p.token){const n=r.players.find(x=>!x.bot&&x.online);r.host=n?.token||r.host}if(r.state.status==='playing'){r.chat.push({from:'SYSTEM',text:`${p.nick} lost signal. ${p.station} automation will relay its feed.`,t:Date.now()});botRelays(r)}emit(r)}})
});
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms){if(r.state.status==='playing'&&r.phase==='crisis'&&r.state.deadline&&now>r.state.deadline){r.chat.push({from:'SYSTEM',text:'Crisis timer expired — hull breach!',t:now});r.state=reduce(r.state,{type:'SUBMIT',actions:[]});if(r.settings.saboteur)beginVote(r);else if(['won','lost'].includes(r.state.status))finish(r);else{setDeadline(r);emit(r);botRelays(r)}}if(!r.players.some(p=>!p.bot&&p.online)&&now-r.createdAt>3600000)rooms.delete(c)}},1000).unref();
const port=process.env.PORT||3000;if(require.main===module)server.listen(port,()=>console.log(`DEAD RECKONING on :${port}`));module.exports={app,server};
