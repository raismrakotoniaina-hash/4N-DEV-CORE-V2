import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,BarChart3,BookOpen,ChevronDown,ChevronRight,CircleHelp,Code2,Copy,CreditCard,ExternalLink,Eye,EyeOff,FileCode2,Image,KeyRound,LayoutDashboard,Menu,MoreHorizontal,PanelLeftClose,PanelLeftOpen,Plus,Search,Settings,ShieldCheck,Sparkles,WalletCards,X,Zap} from 'lucide-react';
import './styles.css';

const nav=[
 {label:'Overview',icon:LayoutDashboard},
 {label:'AI services',icon:Sparkles,items:['Chat','Coding','Image']},
 {label:'API keys',icon:KeyRound},
 {label:'Usage',icon:BarChart3},
 {label:'Billing',icon:CreditCard},
 {label:'Projects',icon:FileCode2},
];
const API_BASE=import.meta.env.VITE_CORE_API_URL||'';
async function api(path,options={}){const res=await fetch(API_BASE+path,options);const data=await res.json();if(!res.ok)throw new Error(data.error||'Request failed');return data;}
const services=[
 {name:'Chat',icon:Sparkles,desc:'Conversational AI',detail:'Fast conversational models for assistants, support and product experiences.',endpoint:'/v1/chat',cost:'1 credit / request'},
 {name:'Coding',icon:Code2,desc:'Code generation & analysis',detail:'Generate, explain, refactor and review code through the Core API.',endpoint:'/v1/coding',cost:'8 credits / request'},
 {name:'Image',icon:Image,desc:'Image generation',detail:'Generate production-ready images from text prompts.',endpoint:'/v1/image',cost:'50 credits / image'}
];

function App(){
 const [authenticated,setAuthenticated]=useState(()=>sessionStorage.getItem('4n_dev_demo_session')==='1');
 const [developer,setDeveloper]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('4n_dev_demo_user'))||{name:'Developer',email:'developer@4ndev.local'};}catch{return {name:'Developer',email:'developer@4ndev.local'}}});
 const [active,setActive]=useState('Overview');
 const [open,setOpen]=useState(true);
 const [mobile,setMobile]=useState(false);
 const [profile,setProfile]=useState(false);
 const [showKey,setShowKey]=useState(false);
 const [modal,setModal]=useState(false);
 const [keyName,setKeyName]=useState('');
 const [created,setCreated]=useState(false);
 const [toast,setToast]=useState('');
 const [dashboard,setDashboard]=useState(null);
 const [keys,setKeys]=useState([]);
 const [loadingKeys,setLoadingKeys]=useState(false);
 const [revealedSecret,setRevealedSecret]=useState('');
 const [revealedName,setRevealedName]=useState('');
 const [revokeTarget,setRevokeTarget]=useState(null);
 const [projects,setProjects]=useState([]);
 const [loadingProjects,setLoadingProjects]=useState(false);
 const loadKeys=async()=>{setLoadingKeys(true);try{const data=await api('/api/keys');setKeys(data.keys||[]);}catch(e){notify('Unable to load API keys');}finally{setLoadingKeys(false);}};
 useEffect(()=>{api('/api/dashboard').then(setDashboard).catch(()=>{});loadKeys();loadProjects();},[]);
 const [search,setSearch]=useState(false);
 const loadProjects=async()=>{setLoadingProjects(true);try{const data=await api('/api/projects');setProjects(data.projects||[]);}catch(e){notify('Unable to load projects');}finally{setLoadingProjects(false);}};
 const createProject=async(name)=>{try{await api('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});await loadProjects();notify('Project created');}catch(e){notify(e.message||'Unable to create project');}};
 const archiveProject=async(id)=>{try{await api('/api/projects/'+id+'/archive',{method:'POST'});await loadProjects();notify('Project archived');}catch(e){notify(e.message||'Unable to archive project');}};
 const key=keys.find(k=>k.active)?.prefix||'4ndev_sk_live_';

 const go=(page)=>{setActive(page);setMobile(false);setProfile(false);};
 const signOut=()=>{sessionStorage.removeItem('4n_dev_demo_session');sessionStorage.removeItem('4n_dev_demo_user');setAuthenticated(false);setProfile(false);};
 if(!authenticated)return <AuthPage onLogin={(user)=>{sessionStorage.setItem('4n_dev_demo_session','1');sessionStorage.setItem('4n_dev_demo_user',JSON.stringify(user));setDeveloper(user);setAuthenticated(true);}}/>;
 const notify=(msg)=>{setToast(msg);setTimeout(()=>setToast(''),2200);};
 const copyKey=async(value=key,full=false)=>{try{await navigator.clipboard.writeText(value);notify(full?'API key copied':'Key prefix copied');}catch{notify('Copy unavailable on this device');}};
 const createKey=async()=>{if(!keyName.trim())return;try{const data=await api('/api/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:keyName.trim()})});setCreated(true);setModal(false);setKeyName('');setRevealedSecret(data.key.secret);setRevealedName(data.key.name);await loadKeys();notify('API key created');}catch(e){notify(e.message||'Unable to create API key');}};
 const revokeKey=async(id)=>{try{await api('/api/keys/'+id+'/revoke',{method:'POST'});await loadKeys();setRevokeTarget(null);notify('API key revoked');}catch(e){notify(e.message||'Unable to revoke API key');}};

 return <div className="app">
  <aside className={`sidebar ${open?'':'collapsed'} ${mobile?'mobile-open':''}`}>
   <div className="brand"><div className="brand-mark">4N</div>{open&&<div><strong>4N DEV</strong><span>Developer Console</span></div>}<button className="icon-btn side-toggle" onClick={()=>setOpen(!open)}>{open?<PanelLeftClose/>:<PanelLeftOpen/>}</button></div>
   {open&&<div className="workspace"><span className="eyebrow">WORKSPACE</span><button className="workspace-btn"><div className="avatar">D</div><div><b>{developer.name}</b><small>Personal workspace</small></div><ChevronDown/></button></div>}
   <nav>{nav.map(n=>{const I=n.icon;return <div key={n.label}><button className={active===n.label?'nav-item active':'nav-item'} onClick={()=>go(n.label)}><I/>{open&&<span>{n.label}</span>}{open&&n.items&&<ChevronDown className="nav-chevron"/>}</button>{open&&n.items&&<div className="subnav">{n.items.map(x=><button className={active===x?'selected':''} key={x} onClick={()=>go(x)}>{x}</button>)}</div>}</div>})}</nav>
   <div className="sidebar-bottom">{open&&<><button className={active==='Documentation'?'nav-item active':'nav-item'} onClick={()=>go('Documentation')}><BookOpen/><span>Documentation</span><ExternalLink className="tiny"/></button><button className="nav-item" onClick={()=>notify('Help center is being prepared')}><CircleHelp/><span>Help center</span></button></>}<button className={active==='Settings'?'nav-item active':'nav-item'} onClick={()=>go('Settings')}><Settings/>{open&&<span>Settings</span>}</button></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main">
   <header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs"><span>4N DEV</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="icon-btn" onClick={()=>setSearch(!search)}><Search/></button>{search&&<input autoFocus className="search-box" placeholder="Search console..." onKeyDown={e=>e.key==='Escape'&&setSearch(false)}/>}<button className="help" onClick={()=>go('Documentation')}>Docs</button><div className="profile-wrap"><button className="user" onClick={()=>setProfile(!profile)}><span>DR</span><ChevronDown/></button>{profile&&<div className="profile-menu"><b>{developer.name}</b><small>{developer.email}</small><hr/><button onClick={()=>go('Billing')}>Billing & plan</button><button onClick={()=>go('Settings')}>Account settings</button><button onClick={signOut}>Sign out</button></div>}</div></div></header>
   <div className="content">
    {active==='Overview'&&<Overview go={go} dashboard={dashboard} showKey={showKey} setShowKey={setShowKey} keyValue={key} copyKey={copyKey} setModal={setModal} created={created} keys={keys} loadingKeys={loadingKeys} revokeKey={revokeKey}/>}
    {active==='AI services'&&<Services go={go}/>}
    {['Chat','Coding','Image'].includes(active)&&<ServiceDetail service={services.find(s=>s.name===active)} onBack={()=>go('AI services')} notify={notify}/>}
    {active==='API keys'&&<Keys showKey={showKey} setShowKey={setShowKey} keyValue={key} copyKey={copyKey} setModal={setModal} created={created} notify={notify} keys={keys} loadingKeys={loadingKeys} revokeKey={revokeKey} setRevokeTarget={setRevokeTarget}/>}
    {active==='Usage'&&<Usage dashboard={dashboard}/>}
    {active==='Billing'&&<Billing dashboard={dashboard}/>}
    {active==='Projects'&&<Projects projects={projects} loading={loadingProjects} createProject={createProject} archiveProject={archiveProject}/>}
    {active==='Settings'&&<SettingsPage notify={notify} developer={developer} onSignOut={signOut}/>}
   </div>
  </main>
  {modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Create API key</h3><p>Use a separate key for each application.</p></div><button className="icon-btn" onClick={()=>setModal(false)}><X/></button></div><label>Key name<input value={keyName} onChange={e=>setKeyName(e.target.value)} placeholder="e.g. My production app" autoFocus/></label><div className="warning"><ShieldCheck/><span>Store this credential securely. Never expose it in client-side code.</span></div><div className="modal-actions"><button className="secondary" onClick={()=>setModal(false)}>Cancel</button><button className="primary" disabled={!keyName.trim()} onClick={createKey}>Create key</button></div></div></div>}
  {revealedSecret&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><h3>API key created</h3><p>{revealedName} · copy this secret now.</p></div><button className="icon-btn" onClick={()=>setRevealedSecret('')}><X/></button></div><div className="secret-box">{revealedSecret}</div><div className="warning"><ShieldCheck/><span>This secret is shown only once. Store it securely and never expose it in client-side code.</span></div><div className="modal-actions"><button className="primary" onClick={()=>copyKey(revealedSecret)}><Copy/> Copy secret</button><button className="secondary" onClick={()=>setRevealedSecret('')}>Done</button></div></div></div>}
  {revokeTarget&&<div className="modal-backdrop" onClick={()=>setRevokeTarget(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Revoke API key?</h3><p>{revokeTarget.name} will no longer be usable.</p></div><button className="icon-btn" onClick={()=>setRevokeTarget(null)}><X/></button></div><div className="warning"><ShieldCheck/><span>This action disables the credential immediately. Existing applications using this key will need another active key.</span></div><div className="modal-actions"><button className="secondary" onClick={()=>setRevokeTarget(null)}>Cancel</button><button className="danger-primary" onClick={()=>revokeKey(revokeTarget.id)}>Revoke key</button></div></div></div>}
  {toast&&<div className="toast">{toast}</div>}
 </div>
}

function AuthPage({onLogin}){
 const [mode,setMode]=useState('login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [forgot,setForgot]=useState(false);
 const [message,setMessage]=useState('');
 const submit=(e)=>{e.preventDefault();if(forgot){setMessage('Password recovery will connect to the Core authentication service.');return;}if(!email.trim()||!password.trim()||(mode==='signup'&&!name.trim()))return;onLogin({name:name.trim()||email.split('@')[0]||'Developer',email:email.trim()});};
 return <div className="auth-shell"><div className="auth-glow glow-a"/><div className="auth-glow glow-b"/><div className="auth-card"><div className="auth-brand"><div className="brand-mark">4N</div><div><strong>4N DEV</strong><span>Developer Platform</span></div></div>{forgot?<><div className="auth-copy"><p className="kicker">ACCOUNT RECOVERY</p><h1>Reset your password</h1><p>Enter your developer email and we will connect this flow to the secure Core authentication service.</p></div><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoFocus required/></label>{message&&<div className="auth-message">{message}</div>}<button className="primary auth-submit" type="submit">Continue</button><button className="auth-link" type="button" onClick={()=>{setForgot(false);setMessage('');}}>Back to sign in</button></form></>:<><div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Sign in</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Create account</button></div><div className="auth-copy"><p className="kicker">4N DEV CORE</p><h1>{mode==='login'?'Welcome back.':'Create your developer account.'}</h1><p>{mode==='login'?'Sign in to manage your Core API workspace, keys, usage and billing.':'Start with a developer workspace and connect your applications to 4N DEV Core.'}</p></div><form onSubmit={submit}>{mode==='signup'&&<label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoFocus required/></label>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoFocus={mode==='login'} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength="6"/></label>{mode==='login'&&<div className="auth-row"><span>Secure developer account</span><button type="button" className="auth-link-inline" onClick={()=>setForgot(true)}>Forgot password?</button></div>}<button className="primary auth-submit" type="submit">{mode==='login'?'Sign in':'Create account'}</button></form><div className="auth-note"><ShieldCheck/> <span>This is the frontend authentication shell. Real sessions, password storage and account persistence will be connected to the Core server.</span></div></>}</div></div>
}
function Header({title,subtitle,action}){return <div className="page-head"><div><p className="kicker">DEVELOPER PLATFORM</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{action}</div>}
function Overview({go,dashboard,showKey,setShowKey,keyValue,copyKey,setModal,created,keys,loadingKeys,revokeKey}){return <>
 <Header title="Overview" subtitle="Build with the 4N DEV Core API." action={<button className="primary" onClick={()=>setModal(true)}><Plus/> Create API key</button>}/>
 <section className="hero"><div><div className="status"><span className="dot"/> All systems operational</div><h2>Everything you need to build with AI.</h2><p>Access 4N DEV Core models, manage credentials, monitor usage and control your workspace from one place.</p><div className="hero-actions"><button className="primary" onClick={()=>go('AI services')}>Explore the API <ChevronRight/></button><button className="secondary" onClick={()=>go('Documentation')}>Read documentation</button></div></div><div className="orb"><div className="orb-ring ring1"/><div className="orb-ring ring2"/><div className="orb-core"><Sparkles/></div></div></section>
 <div className="section-title"><div><h3>Workspace</h3><p>Current account and platform activity.</p></div><button className="ghost" onClick={()=>go('Usage')}>View usage <ExternalLink/></button></div>
 <div className="stats"><Stat icon={WalletCards} label="Available credits" value={dashboard?.workspace?.credits?.toLocaleString() ?? "—"} note={dashboard?.workspace?.monthlyCredits ? `${dashboard.workspace.monthlyCredits.toLocaleString()} credits / month` : "Plan data unavailable"}/><Stat icon={Activity} label="API requests" value={dashboard?.usage?.requests?.toLocaleString() ?? "—"} note="This billing period"/><Stat icon={Zap} label="Current plan" value={dashboard?.workspace?.plan ?? "—"} note={dashboard?.workspace?.monthlyCredits ? `${dashboard.workspace.monthlyCredits.toLocaleString()} credits / month` : "Plan data unavailable"}/><Stat icon={ShieldCheck} label="API status" value={dashboard ? "Operational" : "Loading…"} note={dashboard?.usage?.successRate ? `${dashboard.usage.successRate}% success rate` : "Connecting to Core"} /></div>
 <div className="grid"><Keys showKey={showKey} setShowKey={setShowKey} keyValue={keyValue} copyKey={copyKey} setModal={setModal} created={created} keys={keys} loadingKeys={loadingKeys} revokeKey={revokeKey}/><section className="card"><div className="card-head"><div><h3>AI services</h3><p>Core capabilities available to your plan.</p></div></div>{services.map(s=><Service key={s.name} icon={s.icon} name={s.name} desc={s.desc} onClick={()=>go(s.name)}/>) }<button className="link-btn" onClick={()=>go('AI services')}>View all services <ExternalLink/></button></section></div>
 <section className="card quick"><div><h3>Quick start</h3><p>Make your first API request in minutes.</p></div><div className="code"><span>Authorization:</span> Bearer <em>4ndev_sk_••••••••</em></div><button className="secondary" onClick={()=>go('Documentation')}>View API reference</button></section>
 </>}
function Stat({icon:Icon,label,value,note}){return <div className="stat"><div className="stat-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function Keys({showKey,setShowKey,keyValue,copyKey,setModal,created,notify,keys,loadingKeys,revokeKey,setRevokeTarget}){const activeCount=keys.filter(k=>k.active).length;return <section className="card keys"><div className="card-head"><div><h3>API keys</h3><p>Credentials used by your applications.</p></div><button className="secondary small" onClick={()=>setModal(true)}><Plus/> New key</button></div><div className="key-summary"><div><span>Active keys</span><strong>{activeCount}</strong></div><div><span>Total keys</span><strong>{keys.length}</strong></div><div className="key-summary-note"><ShieldCheck/><span>Secrets are never returned after creation.</span></div></div>{loadingKeys?<div className="empty-key">Loading API keys…</div>:keys.length===0?<div className="empty-key">No API keys yet. Create one for your application.</div>:keys.map(k=><div className="key-row" key={k.id}><div className="key-icon"><KeyRound/></div><div className="key-main"><b>{k.name}</b><span>{k.prefix}••••••••••••</span><small>Created {new Date(k.createdAt).toLocaleDateString()}</small></div><span className={k.active?'key-status active':'key-status'}>{k.active?'Active':'Revoked'}</span>{k.active&&<button className="icon-btn danger-btn" title="Revoke key" onClick={()=>setRevokeTarget(k)}><X/></button>}<button className="icon-btn" onClick={()=>copyKey(k.prefix)} title="Copy key prefix"><Copy/></button></div>)}<div className="card-foot"><span className="live-dot"/> Use one key per application or environment.</div>{created&&<div className="new-key-note">Key created successfully. The secret was shown once above.</div>}</section>}
function Service({icon:Icon,name,desc,onClick}){return <button className="service service-button" onClick={onClick}><div className="service-icon"><Icon/></div><div><b>{name}</b><span>{desc}</span></div><span className="available">Available</span></button>}
function Services({go}){return <><Header title="AI services" subtitle="Explore the capabilities exposed by 4N DEV Core."/><div className="service-grid">{services.map(s=><button className="service-card" key={s.name} onClick={()=>go(s.name)}><div className="service-icon large"><s.icon/></div><h3>{s.name}</h3><p>{s.desc}</p><span>Available <ChevronRight/></span></button>)}</div></>}
function ServiceDetail({service,onBack,notify}){const I=service.icon;return <><button className="back-link" onClick={onBack}>← AI services</button><Header title={service.name} subtitle={service.detail}/><div className="detail-grid"><section className="card"><div className="detail-icon"><I/></div><h3>Core API</h3><p className="detail-text">{service.detail}</p><div className="endpoint"><span>POST</span>{service.endpoint}</div><button className="primary" onClick={()=>notify('API reference opened in the next backend phase')}><BookOpen/> View API reference</button></section><section className="card"><h3>Plan access</h3><div className="detail-row"><span>Status</span><b className="green">Available</b></div><div className="detail-row"><span>Usage cost</span><b>{service.cost}</b></div><div className="detail-row"><span>Authentication</span><b>Bearer API key</b></div></section></div></>}
function Usage({dashboard}){const u=dashboard?.usage;const w=dashboard?.workspace;return <><Header title="Usage" subtitle="Monitor requests, credits and activity."/><div className="stats"><Stat icon={Activity} label="Requests" value={u?.requests?.toLocaleString() ?? "—"} note="This billing period"/><Stat icon={WalletCards} label="Credits used" value={u?.creditsUsed?.toLocaleString() ?? "—"} note={w?.monthlyCredits ? `Of ${w.monthlyCredits.toLocaleString()} monthly` : "Plan data unavailable"}/><Stat icon={Zap} label="Remaining" value={w?.credits?.toLocaleString() ?? "—"} note="Available now"/><Stat icon={BarChart3} label="Success rate" value={u?.successRate != null ? `${u.successRate}%` : "—"} note="Last 30 days"/></div><section className="card usage-card"><div className="card-head"><div><h3>API activity</h3><p>Requests across Core services.</p></div></div><div className="bars">{[35,52,42,68,57,82,64,91,73,88,76,96].map((h,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:h+'%'}}/><small>{i+1}</small></div>)}</div></section></>}
function Billing({dashboard}){const [message,setMessage]=useState('');const w=dashboard?.workspace;const u=dashboard?.usage;const monthly=Number(w?.monthlyCredits||0);const used=Number(u?.creditsUsed||0);const remaining=Number(w?.credits||0);const percent=monthly>0?Math.min(100,Math.max(0,(used/monthly)*100)):0;const notifyPlan=()=>{setMessage('Plan management will be connected to the Core billing service.');setTimeout(()=>setMessage(''),2600);};return <><Header title="Billing" subtitle="Manage your plan, credits and payment settings."/><div className="billing-grid"><section className="card plan-card"><span className="kicker">CURRENT PLAN</span><h2>{w?.plan??'—'}</h2><p>{monthly?monthly.toLocaleString()+' credits / month':'Plan data unavailable'}</p><strong>Billing backend pending</strong><button className="primary" onClick={notifyPlan}>Manage plan</button></section><section className="card"><div className="card-head"><div><h3>Credits</h3><p>Current billing-period consumption.</p></div><span className="billing-percent">{monthly?Math.round(percent)+'%':'—'}</span></div><div className="progress"><span style={{width:percent+'%'}}/></div><div className="billing-metrics"><div><span>Used</span><b>{used.toLocaleString()}</b></div><div><span>Remaining</span><b>{remaining.toLocaleString()}</b></div><div><span>Monthly</span><b>{monthly.toLocaleString()}</b></div></div><hr/><h3>Payment method</h3><div className="payment pending"><CreditCard/><div><b>Not connected</b><span>Payment settings will be connected to the Core billing backend.</span></div></div></section></div>{message&&<div className="toast">{message}</div>}</>}
function Projects({projects,loading,createProject,archiveProject}){const [modal,setModal]=useState(false);const [name,setName]=useState('');const submit=()=>{if(!name.trim())return;createProject(name.trim());setName('');setModal(false);};return <><Header title="Projects" subtitle="Organize applications that use your Core API." action={<button className="primary" onClick={()=>setModal(true)}><Plus/> Create project</button>}/>{loading?<section className="card empty"><p>Loading projects…</p></section>:projects.length===0?<section className="empty card"><div className="empty-icon"><FileCode2/></div><h3>No projects yet</h3><p>Create a project for each independent application that uses 4N DEV Core.</p><button className="primary" onClick={()=>setModal(true)}><Plus/> Create project</button></section>:<section className="project-list">{projects.map(p=><div className="card project-row" key={p.id}><div className="project-icon"><FileCode2/></div><div className="project-main"><h3>{p.name}</h3><p>{p.id} · Created {new Date(p.createdAt).toLocaleDateString()}</p></div><span className={p.status==='active'?'key-status active':'key-status'}>{p.status}</span>{p.status==='active'&&<button className="secondary small" onClick={()=>archiveProject(p.id)}>Archive</button>}</div>)}</section>}{modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Create project</h3><p>Projects stay independent from Core itself.</p></div><button className="icon-btn" onClick={()=>setModal(false)}><X/></button></div><label>Project name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. N-AI Chat" autoFocus/></label><div className="warning"><ShieldCheck/><span>Each application can have its own project and API keys.</span></div><div className="modal-actions"><button className="secondary" onClick={()=>setModal(false)}>Cancel</button><button className="primary" disabled={!name.trim()} onClick={submit}>Create project</button></div></div></div>}</>}
function Documentation({notify}){
 const [lang,setLang]=useState('JavaScript');
 const [copied,setCopied]=useState('');
 const base='<CORE_API_BASE_URL>';
 const snippets={
  JavaScript:`const CORE_API_BASE_URL = process.env.CORE_API_BASE_URL;
const CORE_API_KEY = process.env.CORE_API_KEY;

const response = await fetch(\`\\${CORE_API_BASE_URL}/v1/chat\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${CORE_API_KEY}\`
  },
  body: JSON.stringify({
    model: process.env.CORE_CHAT_MODEL,
    messages: [
      { role: 'user', content: 'Hello from my app' }
    ]
  })
});

if (!response.ok) {
  throw new Error(\`Core API error: \${response.status}\`);
}

const data = await response.json();
console.log(data);`,
  Python:`import os
import requests

CORE_API_BASE_URL = os.environ["CORE_API_BASE_URL"]
CORE_API_KEY = os.environ["CORE_API_KEY"]

response = requests.post(
    f"{CORE_API_BASE_URL}/v1/chat",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CORE_API_KEY}",
    },
    json={
        "model": os.environ["CORE_CHAT_MODEL"],
        "messages": [
            {"role": "user", "content": "Hello from my app"}
        ],
    },
    timeout=60,
)

response.raise_for_status()
print(response.json())`,
  cURL:`curl "$CORE_API_BASE_URL/v1/chat" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CORE_API_KEY" \
  -d '{
    "model": "$CORE_CHAT_MODEL",
    "messages": [
      {"role": "user", "content": "Hello from my app"}
    ]
  }'`
 };
 const copy=async()=>{
  try{await navigator.clipboard.writeText(snippets[lang]);setCopied(lang);notify('Code copied');setTimeout(()=>setCopied(''),1600);}
  catch{notify('Copy unavailable on this device');}
 };
 return <>
  <Header title="Documentation" subtitle="Build independent applications on top of the 4N DEV Core API."/>
  <div className="docs-layout">
   <aside className="card docs-nav">
    <div className="docs-nav-title">API reference</div>
    <button className="selected">Quick start</button>
    <button onClick={()=>document.getElementById('docs-auth')?.scrollIntoView({behavior:'smooth'})}>Authentication</button>
    <button onClick={()=>document.getElementById('docs-chat')?.scrollIntoView({behavior:'smooth'})}>Chat</button>
    <button onClick={()=>document.getElementById('docs-services')?.scrollIntoView({behavior:'smooth'})}>Coding & Image</button>
    <button onClick={()=>document.getElementById('docs-errors')?.scrollIntoView({behavior:'smooth'})}>Errors</button>
    <button onClick={()=>document.getElementById('docs-usage')?.scrollIntoView({behavior:'smooth'})}>Credits & usage</button>
   </aside>
   <div className="docs-main">
    <section className="card docs-card">
     <div className="docs-kicker">QUICK START</div>
     <h2>Connect your application to 4N DEV Core</h2>
     <p>Use a <code>4ndev_sk_...</code> secret from API keys and send authenticated requests from your server. Your application remains independent; Core provides the AI infrastructure.</p>
     <div className="docs-contract"><div><span>Production base URL</span><strong>To be configured with the production Core server</strong></div><div><span>Authentication</span><strong>Bearer API key</strong></div></div>
     <div className="docs-callout"><ShieldCheck/><div><b>Important</b><span>This documentation defines the intended API contract for V2. The production base URL, model IDs and live service endpoints will be finalized when the Core server is connected.</span></div></div>
    </section>

    <section className="card docs-card" id="docs-auth">
     <div className="docs-kicker">AUTHENTICATION</div>
     <h2>Use your API key securely</h2>
     <p>Send the key in the <code>Authorization</code> header. Keep it on your server or trusted backend; never put it in browser JavaScript, mobile source code or public repositories.</p>
     <div className="docs-code-line"><span>Authorization</span><code>Bearer 4ndev_sk_...</code></div>
    </section>

    <section className="card docs-card" id="docs-chat">
     <div className="docs-kicker">CHAT API</div>
     <h2>Make a chat request</h2>
     <p>The example below is intentionally contract-based. Replace the environment values with the official production configuration once Core is connected.</p>
     <div className="code-tabs">{Object.keys(snippets).map(x=><button key={x} className={lang===x?'active':''} onClick={()=>setLang(x)}>{x}</button>)}<button className="copy-code" onClick={copy}><Copy/>{copied===lang?'Copied':'Copy code'}</button></div>
     <pre className="docs-code"><code>{snippets[lang]}</code></pre>
     <div className="docs-example-grid"><div><span>Request</span><pre><code>{`{
  "model": "<CHAT_MODEL>",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}`}</code></pre></div><div><span>Response shape</span><pre><code>{`{
  "id": "<REQUEST_ID>",
  "model": "<CHAT_MODEL>",
  "output": "<MODEL_OUTPUT>",
  "usage": {
    "credits": 1
  }
}`}</code></pre></div></div>
    </section>

    <section className="card docs-card" id="docs-services">
     <div className="docs-kicker">SERVICES</div>
     <h2>Coding and Image</h2>
     <div className="docs-endpoints">
      <div><span className="method">POST</span><b>/v1/coding</b><small>Code generation, analysis, refactoring and review. Contract and model IDs will be finalized with production Core.</small></div>
      <div><span className="method">POST</span><b>/v1/image</b><small>Image generation. Image options, model IDs and response format will be finalized with production Core.</small></div>
     </div>
    </section>

    <section className="card docs-card" id="docs-errors">
     <div className="docs-kicker">ERRORS</div>
     <h2>Handle API errors</h2>
     <div className="docs-errors"><div><b>401</b><span>Invalid, missing or revoked API key.</span></div><div><b>402</b><span>Insufficient credits or billing restriction.</span></div><div><b>400</b><span>Invalid request parameters.</span></div><div><b>429</b><span>Rate limit exceeded.</span></div><div><b>5xx</b><span>Temporary Core service failure; retry with backoff where appropriate.</span></div></div>
    </section>

    <section className="card docs-card" id="docs-usage">
     <div className="docs-kicker">CREDITS & USAGE</div>
     <h2>Know what each request costs</h2>
     <div className="docs-costs"><div><b>Chat</b><span>1 credit / request</span></div><div><b>Coding</b><span>8 credits / request</span></div><div><b>Image</b><span>50 credits / image</span></div></div>
     <p className="docs-muted">Usage and credit balances are visible in Developer Console. Final production pricing, model-specific costs and usage response fields are controlled by the Core billing contract.</p>
    </section>

    <section className="card docs-card">
     <div className="docs-kicker">ENDPOINTS & MODELS</div>
     <h2>API surface</h2>
     <div className="docs-endpoint-table"><div><b>POST /v1/chat</b><span>Chat generation</span></div><div><b>POST /v1/coding</b><span>Coding generation and analysis</span></div><div><b>POST /v1/image</b><span>Image generation</span></div></div>
     <p className="docs-muted">Model identifiers are not hard-coded in this console yet. Production model names will be published here when the Core server contract is finalized.</p>
    </section>
   </div>
  </div>
 </>
}
function SettingsPage({notify,developer,onSignOut}){return <><Header title="Settings" subtitle="Manage your developer account, workspace and security."/><div className="settings-list">
<section className="card settings-card"><div className="card-head"><div><h3>Developer account</h3><p>Your account identity for the Core Developer Console.</p></div><span className="settings-badge">ACCOUNT</span></div><div className="detail-row"><span>Full name</span><b>{developer?.name||'Developer'}</b></div><div className="detail-row"><span>Email</span><b>{developer?.email||'—'}</b></div><button className="secondary" onClick={()=>notify('Profile editing will be connected to Core authentication')}>Edit profile</button></section>
<section className="card settings-card"><div className="card-head"><div><h3>Workspace</h3><p>Workspace configuration and plan ownership.</p></div></div><div className="detail-row"><span>Workspace</span><b>Personal workspace</b></div><div className="detail-row"><span>Role</span><b>Developer</b></div><div className="detail-row"><span>API platform</span><b className="green">4N DEV Core</b></div><button className="secondary" onClick={()=>notify('Workspace management will be connected to the Core server')}>Manage workspace</button></section>
<section className="card settings-card"><div className="card-head"><div><h3>Security</h3><p>Protection policies for your developer credentials.</p></div><span className="settings-badge secure">SECURE</span></div><div className="security-item"><ShieldCheck/><div><b>API key protection</b><span>Credentials are intended for server-side use and are never exposed in client-side code.</span></div><strong>Enabled</strong></div><div className="security-item"><KeyRound/><div><b>Key lifecycle</b><span>Create separate keys per application or environment and revoke compromised credentials immediately.</span></div><strong>Managed</strong></div><button className="secondary" onClick={()=>notify('Password, sessions and MFA will be connected to Core authentication')}>Manage authentication</button></section>
<section className="card settings-card"><div className="card-head"><div><h3>Session</h3><p>This device is currently signed in to the Developer Console.</p></div></div><div className="detail-row"><span>Session type</span><b>Developer Console</b></div><div className="detail-row"><span>Persistence</span><b>Device session</b></div><button className="secondary danger-outline" onClick={onSignOut}>Sign out</button></section>
</div><section className="card settings-note"><ShieldCheck/><div><h3>Production security</h3><p>Authentication, password hashing, sessions, MFA and account persistence remain server-side responsibilities. This V2 frontend currently uses a temporary local session shell until the production Core authentication service is connected.</p></div></section></>}
createRoot(document.getElementById('root')).render(<App/>);