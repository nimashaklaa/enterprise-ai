// Atlas UI logic. All DOM content is written with textContent (never untrusted innerHTML).
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};

// Conversation identifier for this browser session (not an authentication token).
let conversationId=sessionStorage.getItem('atlas_conversation_id')||crypto.randomUUID();
sessionStorage.setItem('atlas_conversation_id',conversationId);

const toast=msg=>{const t=$('toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',4000)};

// Turns FastAPI errors (string, validation list, or object) into readable text.
const api=async(path,options={})=>{
  const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  let data=null;try{data=await res.json()}catch{}
  if(!res.ok){
    const d=data&&data.detail;
    const msg=typeof d==='string'?d
      :Array.isArray(d)?d.map(x=>`${(x.loc||[]).slice(1).join('.')}: ${x.msg}`).join('; ')
      :d?JSON.stringify(d):`Request failed (${res.status})`;
    throw Error(msg);
  }
  return data;
};

$('newChat').onclick=()=>{conversationId=crypto.randomUUID();sessionStorage.setItem('atlas_conversation_id',conversationId);$('messages').replaceChildren();toast('Started a new conversation');loadHistory()};

/* ---------- Navigation ---------- */
const TITLES={chat:"Ask your organization's knowledge",docs:'Document management',approval:'Approval requests',admin:'Operational overview'};
function view(name){
  ['chat','docs','approval','admin'].forEach(x=>{$(x+'View').classList.toggle('hidden',x!==name);$(x+'Tab').classList.toggle('active',x===name)});
  $('heading').textContent=TITLES[name];
  if(name==='docs')loadDocs();
  if(name==='admin')loadMetrics();
  if(name==='approval')loadApprovals();
}
$('chatTab').onclick=()=>view('chat');$('docsTab').onclick=()=>view('docs');
$('adminTab').onclick=()=>view('admin');$('approvalTab').onclick=()=>view('approval');
$('refreshApprovals').onclick=loadApprovals;

/* ---------- Chat ---------- */
function addMessage(content,kind,sources=[]){
  const m=el('div','message '+kind,content);
  if(sources.length){
    const wrap=el('div','sources');
    sources.forEach(s=>{
      const d=document.createElement('details');
      d.append(el('summary','',`[${s.index}] ${s.title}, page ${s.page}`),el('p','',s.excerpt));
      wrap.append(d);
    });
    m.append(wrap);
    const fb=el('button','','Mark as helpful');
    fb.onclick=async()=>{try{await api('/api/feedback',{method:'POST',body:JSON.stringify({rating:1})});fb.disabled=true;fb.textContent='Thanks for the feedback';toast('Feedback saved')}catch(e){toast(e.message)}};
    m.append(fb);
  }
  $('messages').append(m);
  $('messages').scrollTo({top:$('messages').scrollHeight,behavior:'smooth'});
  return m;
}
$('chatForm').onsubmit=async e=>{
  e.preventDefault();
  const q=$('question').value.trim();if(!q)return;
  addMessage(q,'user');$('question').value='';
  const loading=addMessage('Searching your documents...','assistant');
  try{
    const r=await api('/api/chat',{method:'POST',body:JSON.stringify({question:q,conversation_id:conversationId})});
    loading.remove();
    const m=addMessage(r.answer,'assistant',r.sources||[]);
    loadHistory();
    if(r.status==='pending_approval'){
      const b=el('button','','Review approval request');b.onclick=()=>view('approval');m.append(b);
    }
  }catch(err){loading.textContent=err.message}
};
$('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatForm').requestSubmit()}});
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{$('question').value=b.dataset.q;$('question').focus()});

/* ---------- Conversation history ---------- */
async function loadHistory(){
  const root=$('history');
  try{
    const {conversations}=await api('/api/conversations');
    root.replaceChildren();
    if(!conversations.length){root.append(el('p','history-empty','No conversations yet'));return}
    for(const c of conversations){
      const b=el('button','history-item'+(c.id===conversationId?' active':''));
      b.title=c.title;
      b.append(el('span','history-title',c.title),el('span','history-date',new Date(c.updated_at).toLocaleDateString()));
      b.onclick=()=>openConversation(c.id);
      root.append(b);
    }
  }catch(e){root.replaceChildren(el('p','history-empty','History unavailable'))}
}
const showMessages=list=>(list||[]).forEach(m=>addMessage(m.content,m.role==='user'?'user':'assistant'));
async function openConversation(id){
  conversationId=id;sessionStorage.setItem('atlas_conversation_id',id);
  view('chat');$('messages').replaceChildren();
  try{showMessages((await api(`/api/conversations/${encodeURIComponent(id)}/message`)).messages)}
  catch(e){toast(e.message)}
  loadHistory();
}

/* ---------- Documents ---------- */
const STATUS={ready:['Ready','ready'],failed:['Failed','failed'],pending:['Waiting','pending'],processing:['Processing','processing'],retired:['Retired','retired']};
async function loadDocs(){
  const root=$('docs');
  try{
    const {documents}=await api('/api/documents');
    if(!documents.length){root.className='empty-note';root.textContent='No documents yet. Upload a file to get started.';return}
    root.className='';
    const table=el('table','data-table docs-table');
    const hr=el('tr');['Document','Status','Version','Added'].forEach(t=>hr.append(el('th','',t)));
    const thead=el('thead');thead.append(hr);table.append(thead);
    const body=el('tbody');
    for(const d of documents){
      const [label,cls]=STATUS[d.status]||[d.status,''];
      const tr=el('tr');
      const badge=el('span','approval-status '+cls,label);
      const status=el('td');status.append(badge);
      tr.append(el('td','',d.title),status,el('td','','v'+d.current_version),el('td','',d.created_at?new Date(d.created_at).toLocaleDateString():''));
      body.append(tr);
    }
    table.append(body);root.replaceChildren(table);
  }catch(e){root.className='empty-note';root.textContent=e.message}
}
$('uploadForm').onsubmit=async e=>{
  e.preventDefault();
  const f=$('file').files[0];if(!f)return;
  if(f.size>10485760){toast('Maximum file size is 10 MB');return}
  const btn=e.submitter||e.target.querySelector('button');btn.disabled=true;btn.textContent='Uploading...';
  try{
    const r=await api('/api/documents/uploads',{method:'POST',body:JSON.stringify({filename:f.name})});
    const up=await fetch(r.upload_url,{method:'PUT',headers:r.headers,body:f});
    if(!up.ok)throw Error('Upload to storage failed. Check the bucket CORS settings.');
    btn.textContent='Processing...';
    await api('/api/documents/complete',{method:'POST',body:JSON.stringify({document_id:r.document_id})});
    toast('Document is ready to search');$('file').value='';
  }catch(err){toast(err.message)}
  finally{btn.disabled=false;btn.textContent='Upload document';loadDocs()}
};

/* ---------- Metrics ---------- */
const count=(rows,key,val)=>Number((rows.find(r=>r[key]===val)||{}).total||0);
const fmt=n=>Number(n).toLocaleString();
function metricBlock(title,headers,rows,cls=''){
  const box=el('section','metric-block '+cls);box.append(el('h3','',title));
  const t=el('table','mt');
  const hr=el('tr');headers.forEach((h,i)=>hr.append(el('th',i===0?'':'num',h)));
  const thead=el('thead');thead.append(hr);t.append(thead);
  const tb=el('tbody');
  rows.forEach(r=>{
    const tr=el('tr',r.total?'total':'');
    const label=el('td');
    if(r.tone)label.append(el('span','dot '+r.tone));
    label.append(document.createTextNode(r.label));
    tr.append(label,el('td','num',fmt(r.value)));
    if(headers.length>2){
      const td=el('td','num');
      if(r.share!==undefined){
        const pct=Math.round(r.share*100);
        const bar=el('div','bar');const fill=el('span',r.tone||'');fill.style.width=pct+'%';bar.append(fill);
        td.append(bar,el('span','pct',pct+'%'));
      }
      tr.append(td);
    }
    tb.append(tr);
  });
  t.append(tb);box.append(t);return box;
}
async function loadMetrics(){
  const m=$('metrics');
  try{
    const [data,guard]=await Promise.all([api('/api/admin/metrics'),api('/api/admin/guardrails')]);
    const total=data.documents.reduce((n,r)=>n+Number(r.total),0);
    const order=[['ready','Ready to search','ok'],['processing','Processing','info'],['pending','Waiting to process','warn'],['failed','Failed','bad'],['retired','Retired','muted']];
    const docRows=order.map(([k,label,tone])=>{const v=count(data.documents,'status',k);return{label,tone,value:v,share:total?v/total:0}});
    docRows.push({label:'Total documents',value:total,total:true});
    const up=count(data.feedback,'rating',1),down=count(data.feedback,'rating',-1);
    const fbRows=[{label:'Helpful',tone:'ok',value:up},{label:'Not helpful',tone:'bad',value:down},{label:'Total ratings',value:up+down,total:true}];
    const inB=count(guard.events,'action','guardrail_input_blocked'),outB=count(guard.events,'action','guardrail_output_blocked');
    const gRows=[{label:'Input blocked',value:inB},{label:'Output blocked',value:outB},{label:'Total events',value:inB+outB,total:true}];
    m.replaceChildren(
      metricBlock('Document processing',['Status','Documents','Share'],docRows,'wide'),
      metricBlock('Answer feedback',['Rating','Count'],fbRows),
      metricBlock('Guardrail activity',['Event','Count'],gRows)
    );
  }catch(e){m.textContent=e.message}
}
$('refreshMetrics').onclick=loadMetrics;

/* ---------- Approvals ---------- */
async function loadApprovals(){
  const root=$('approvalList');root.textContent='Loading approvals...';
  try{
    const {approvals}=await api('/api/approvals');
    if(!Array.isArray(approvals))throw Error('Unexpected response from /api/approvals');
    const isPending=a=>String(a.status).trim().toLowerCase()==='pending';
    $('approvalSummary').textContent=`${approvals.filter(isPending).length} pending, ${approvals.length} total (most recent 100)`;
    root.replaceChildren();
    if(!approvals.length){root.className='empty-note';root.textContent='No approval requests yet. Ask the chatbot to delete or export a document to create one.';return}
    root.className='';
    for(const a of approvals){
      const card=el('article','approval-card');
      const header=el('div','approval-header');
      header.append(el('strong','',a.question),el('span','approval-status '+a.status,a.status));
      card.append(header,el('p','',`Requested by ${a.requester} on ${new Date(a.created_at).toLocaleString()}`));
      if(isPending(a)){
        const actions=el('div','approval-actions');
        for(const [label,approve] of [['Approve',true],['Reject',false]]){
          const b=el('button',approve?'approve-button':'reject-button',label);
          b.onclick=async()=>{
            const decision=approve?'approve':'reject';
            if(!confirm(`Are you sure you want to ${decision} this request? This records a decision only and does not run the requested action.`))return;
            b.disabled=true;
            try{const r=await api(`/api/approvals/${encodeURIComponent(a.id)}/decision`,{method:'POST',body:JSON.stringify({approve})});toast(`Request ${r.status}. No action was run.`);await loadApprovals()}
            catch(e){toast(e.message);b.disabled=false}
          };
          actions.append(b);
        }
        card.append(actions);
      }else{
        card.append(el('p','',`Reviewed by ${a.reviewer||'unknown'}${a.reviewed_at?' on '+new Date(a.reviewed_at).toLocaleString():''}. No action was run.`));
      }
      root.append(card);
    }
  }catch(e){root.className='empty-note';root.textContent=`Could not load approvals: ${e.message}`;console.error('Approvals loading failed:',e)}
}

/* ---------- Startup ---------- */
loadHistory();
api(`/api/conversations/${encodeURIComponent(conversationId)}/message`).then(r=>showMessages(r.messages)).catch(()=>{});