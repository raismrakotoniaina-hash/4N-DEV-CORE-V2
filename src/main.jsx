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
 useEffect(()=>{api('/api/dashboard').then(setDashboard).catch(()=>{});},[]);
 const [search,setSearch]=useState(false);
 const key='4ndev_sk_live_••••••••••••••••••••••••';

 const go=(page)=>{setActive(page);setMobile(false);setProfile(false);};
 const notify=(msg)=>{setToast(msg);setTimeout(()=>setToast(''),2200);};
 const copyKey=async()=>{try{await navigator.clipboard.writeText('4ndev_sk_live_demo');notify('API key copied');}catch{notify('Copy unavailable on this device');}};
 const createKey=()=>{if(!keyName.trim())return;setCreated(true);setModal(false);notify('API key created in this demo workspace');setKeyName('');};

 return <div className="app">
  <aside className={`sidebar ${open?'':'collapsed'} ${mobile?'mobile-open':''}`}>
   <div className="brand"><div className="brand-mark">4N</div>{open&&<div><strong>4N DEV</strong><span>Developer Console</span></div>}<button className="icon-btn side-toggle" onClick={()=>setOpen(!open)}>{open?<PanelLeftClose/>:<PanelLeftOpen/>}</button></div>
   {open&&<div className="workspace"><span className="eyebrow">WORKSPACE</span><button className="workspace-btn"><div className="avatar">D</div><div><b>Developer</b><small>Personal workspace</small></div><ChevronDown/></button></div>}
   <nav>{nav.map(n=>{const I=n.icon;return <div key={n.label}><button className={active===n.label?'nav-item active':'nav-item'} onClick={()=>go(n.label)}><I/>{open&&<span>{n.label}</span>}{open&&n.items&&<ChevronDown className="nav-chevron"/>}</button>{open&&n.items&&<div className="subnav">{n.items.map(x=><button className={active===x?'selected':''} key={x} onClick={()=>go(x)}>{x}</button>)}</div>}</div>})}</nav>
   <div className="sidebar-bottom">{open&&<><button className="nav-item" onClick={()=>notify('Documentation will open when the API reference is connected')}><BookOpen/><span>Documentation</span><ExternalLink className="tiny"/></button><button className="nav-item" onClick={()=>notify('Help center is being prepared')}><CircleHelp/><span>Help center</span></button></>}<button className={active==='Settings'?'nav-item active':'nav-item'} onClick={()=>go('Settings')}><Settings/>{open&&<span>Settings</span>}</button></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main">
   <header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs"><span>4N DEV</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="icon-btn" onClick={()=>setSearch(!search)}><Search/></button>{search&&<input autoFocus className="search-box" placeholder="Search console..." onKeyDown={e=>e.key==='Escape'&&setSearch(false)}/>}<button className="help" onClick={()=>notify('API documentation is coming next')}>Docs</button><div className="profile-wrap"><button className="user" onClick={()=>setProfile(!profile)}><span>DR</span><ChevronDown/></button>{profile&&<div className="profile-menu"><b>Developer</b><small>Personal workspace</small><hr/><button onClick={()=>go('Billing')}>Billing & plan</button><button onClick={()=>go('Settings')}>Account settings</button><button onClick={()=>notify('Sign out will be connected to authentication')}>Sign out</button></div>}</div></div></header>
   <div className="content">
    {active==='Overview'&&<Overview go={go} showKey={showKey} setShowKey={setShowKey} keyValue={key} copyKey={copyKey} setModal={setModal} created={created}/>}
    {active==='AI services'&&<Services go={go}/>}
    {['Chat','Coding','Image'].includes(active)&&<ServiceDetail service={services.find(s=>s.name===active)} onBack={()=>go('AI services')} notify={notify}/>}
    {active==='API keys'&&<Keys showKey={showKey} setShowKey={setShowKey} keyValue={key} copyKey={copyKey} setModal={setModal} created={created} notify={notify}/>}
    {active==='Usage'&&<Usage/>}
    {active==='Billing'&&<Billing/>}
    {active==='Projects'&&<Projects notify={notify}/>}
    {active==='Settings'&&<SettingsPage notify={notify}/>}
   </div>
  </main>
  {modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Create API key</h3><p>Use a separate key for each application.</p></div><button className="icon-btn" onClick={()=>setModal(false)}><X/></button></div><label>Key name<input value={keyName} onChange={e=>setKeyName(e.target.value)} placeholder="e.g. My production app" autoFocus/></label><div className="warning"><ShieldCheck/><span>Store this credential securely. Never expose it in client-side code.</span></div><div className="modal-actions"><button className="secondary" onClick={()=>setModal(false)}>Cancel</button><button className="primary" disabled={!keyName.trim()} onClick={createKey}>Create key</button></div></div></div>}
  {toast&&<div className="toast">{toast}</div>}
 </div>
}

function Header({title,subtitle,action}){return <div className="page-head"><div><p className="kicker">DEVELOPER PLATFORM</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{action}</div>}
function Overview({go,showKey,setShowKey,keyValue,copyKey,setModal,created}){return <>
 <Header title="Overview" subtitle="Build with the 4N DEV Core API." action={<button className="primary" onClick={()=>setModal(true)}><Plus/> Create API key</button>}/>
 <section className="hero"><div><div className="status"><span className="dot"/> All systems operational</div><h2>Everything you need to build with AI.</h2><p>Access 4N DEV Core models, manage credentials, monitor usage and control your workspace from one place.</p><div className="hero-actions"><button className="primary" onClick={()=>go('AI services')}>Explore the API <ChevronRight/></button><button className="secondary" onClick={()=>go('Documentation')}>Read documentation</button></div></div><div className="orb"><div className="orb-ring ring1"/><div className="orb-ring ring2"/><div className="orb-core"><Sparkles/></div></div></section>
 <div className="section-title"><div><h3>Workspace</h3><p>Current account and platform activity.</p></div><button className="ghost" onClick={()=>go('Usage')}>View usage <ExternalLink/></button></div>
 <div className="stats"><Stat icon={WalletCards} label="Available credits" value="1,250" note="Resets with your plan"/><Stat icon={Activity} label="API requests" value="2,481" note="This billing period"/><Stat icon={Zap} label="Current plan" value="Pro" note="3,500 credits / month"/><Stat icon={ShieldCheck} label="API status" value="Operational" note="99.99% availability"/></div>
 <div className="grid"><Keys showKey={showKey} setShowKey={setShowKey} keyValue={keyValue} copyKey={copyKey} setModal={setModal} created={created}/><section className="card"><div className="card-head"><div><h3>AI services</h3><p>Core capabilities available to your plan.</p></div></div>{services.map(s=><Service key={s.name} icon={s.icon} name={s.name} desc={s.desc} onClick={()=>go(s.name)}/>) }<button className="link-btn" onClick={()=>go('AI services')}>View all services <ExternalLink/></button></section></div>
 <section className="card quick"><div><h3>Quick start</h3><p>Make your first API request in minutes.</p></div><div className="code"><span>Authorization:</span> Bearer <em>4ndev_sk_••••••••</em></div><button className="secondary" onClick={()=>go('Documentation')}>View API reference</button></section>
 </>}
function Stat({icon:Icon,label,value,note}){return <div className="stat"><div className="stat-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function Keys({showKey,setShowKey,keyValue,copyKey,setModal,created,notify}){return <section className="card keys"><div className="card-head"><div><h3>API keys</h3><p>Credentials used by your applications.</p></div><button className="secondary small" onClick={()=>setModal(true)}><Plus/> New key</button></div><div className="key-row"><div className="key-icon"><KeyRound/></div><div className="key-main"><b>Production key</b><span>{showKey?keyValue:'4ndev_sk_live_••••••••••••••••••••••••'}</span></div><button className="icon-btn" onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff/>:<Eye/>}</button><button className="icon-btn" onClick={copyKey}><Copy/></button><button className="icon-btn" onClick={()=>notify('Key actions menu will be connected to backend')}><MoreHorizontal/></button></div><div className="card-foot"><span className="live-dot"/> Active · Created today</div>{created&&<div className="new-key-note">Demo key created successfully. Backend persistence will be connected next.</div>}</section>}
function Service({icon:Icon,name,desc,onClick}){return <button className="service service-button" onClick={onClick}><div className="service-icon"><Icon/></div><div><b>{name}</b><span>{desc}</span></div><span className="available">Available</span></button>}
function Services({go}){return <><Header title="AI services" subtitle="Explore the capabilities exposed by 4N DEV Core."/><div className="service-grid">{services.map(s=><button className="service-card" key={s.name} onClick={()=>go(s.name)}><div className="service-icon large"><s.icon/></div><h3>{s.name}</h3><p>{s.desc}</p><span>Available <ChevronRight/></span></button>)}</div></>}
function ServiceDetail({service,onBack,notify}){const I=service.icon;return <><button className="back-link" onClick={onBack}>← AI services</button><Header title={service.name} subtitle={service.detail}/><div className="detail-grid"><section className="card"><div className="detail-icon"><I/></div><h3>Core API</h3><p className="detail-text">{service.detail}</p><div className="endpoint"><span>POST</span>{service.endpoint}</div><button className="primary" onClick={()=>notify('API reference opened in the next backend phase')}><BookOpen/> View API reference</button></section><section className="card"><h3>Plan access</h3><div className="detail-row"><span>Status</span><b className="green">Available</b></div><div className="detail-row"><span>Usage cost</span><b>{service.cost}</b></div><div className="detail-row"><span>Authentication</span><b>Bearer API key</b></div></section></div></>}
function Usage(){return <><Header title="Usage" subtitle="Monitor requests, credits and activity."/><div className="stats"><Stat icon={Activity} label="Requests" value="2,481" note="This billing period"/><Stat icon={WalletCards} label="Credits used" value="2,250" note="Of 3,500 monthly"/><Stat icon={Zap} label="Remaining" value="1,250" note="Available now"/><Stat icon={BarChart3} label="Success rate" value="99.8%" note="Last 30 days"/></div><section className="card usage-card"><div className="card-head"><div><h3>API activity</h3><p>Requests across Core services.</p></div></div><div className="bars">{[35,52,42,68,57,82,64,91,73,88,76,96].map((h,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:h+'%'}}/><small>{i+1}</small></div>)}</div></section></>}
function Billing(){return <><Header title="Billing" subtitle="Manage your plan, credits and payment settings."/><div className="billing-grid"><section className="card plan-card"><span className="kicker">CURRENT PLAN</span><h2>Pro</h2><p>3,500 credits / month</p><strong>49,900 Ar</strong><button className="primary" onClick={()=>alert('Plan management will be connected to payments.')}>Manage plan</button></section><section className="card"><h3>Credits</h3><div className="progress"><span style={{width:'64%'}}/></div><p className="muted">2,250 used · 1,250 remaining</p><hr/><h3>Payment method</h3><div className="payment"><CreditCard/> <span>Payment method configured</span></div></section></div></>}
function Projects({notify}){return <><Header title="Projects" subtitle="Organize applications that use your Core API."/><section className="empty card"><div className="empty-icon"><FileCode2/></div><h3>No projects yet</h3><p>Create a project when you are ready to connect an application to 4N DEV Core.</p><button className="primary" onClick={()=>notify('Project creation will be connected to the Core backend') }><Plus/> Create project</button></section></>}
function SettingsPage({notify}){return <><Header title="Settings" subtitle="Workspace preferences and security."/><div className="settings-list"><section className="card"><h3>Workspace</h3><div className="detail-row"><span>Name</span><b>Personal workspace</b></div><div className="detail-row"><span>Account</span><b>Developer</b></div></section><section className="card"><h3>Security</h3><div className="detail-row"><span>API key protection</span><b className="green">Enabled</b></div><button className="secondary" onClick={()=>notify('Security settings will be connected to authentication')}>Manage security</button></section></div></>}
createRoot(document.getElementById('root')).render(<App/>);