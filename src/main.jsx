import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,BarChart3,BookOpen,ChevronDown,CircleHelp,Code2,Copy,CreditCard,ExternalLink,Eye,EyeOff,FileCode2,Image,KeyRound,LayoutDashboard,Menu,MoreHorizontal,PanelLeftClose,PanelLeftOpen,Plus,Search,Settings,ShieldCheck,Sparkles,Users,WalletCards,X,Zap} from 'lucide-react';
import './styles.css';

const nav=[
 {label:'Overview',icon:LayoutDashboard},
 {label:'AI services',icon:Sparkles,items:['Chat','Coding','Image']},
 {label:'API keys',icon:KeyRound},
 {label:'Usage',icon:BarChart3},
 {label:'Billing',icon:CreditCard},
 {label:'Projects',icon:FileCode2},
];
function App(){
 const [active,setActive]=useState('Overview'),[open,setOpen]=useState(true),[mobile,setMobile]=useState(false),[profile,setProfile]=useState(false);
 const [showKey,setShowKey]=useState(false);
 const key='4ndev_sk_live_••••••••••••••••••••••••';
 return <div className="app">
  <aside className={`sidebar ${open?'':'collapsed'} ${mobile?'mobile-open':''}`}>
   <div className="brand"><div className="brand-mark">4N</div>{open&&<div><strong>4N DEV</strong><span>Developer Console</span></div>}<button className="icon-btn side-toggle" onClick={()=>setOpen(!open)}>{open?<PanelLeftClose/>:<PanelLeftOpen/>}</button></div>
   <div className="workspace">{open&&<><span className="eyebrow">WORKSPACE</span><button className="workspace-btn"><div className="avatar">D</div><div><b>Developer</b><small>Personal workspace</small></div><ChevronDown/></button></>}</div>
   <nav>{nav.map(n=>{const I=n.icon;return <div key={n.label}><button className={active===n.label?'nav-item active':'nav-item'} onClick={()=>{setActive(n.label);setMobile(false)}}><I/>{open&&<span>{n.label}</span>}{open&&n.items&&<ChevronDown className="nav-chevron"/>}</button>{open&&n.items&&active==='AI services'&&<div className="subnav">{n.items.map(x=><button key={x} onClick={()=>setActive(x)}>{x}</button>)}</div>}</div>})}</nav>
   <div className="sidebar-bottom">{open&&<><button className="nav-item"><BookOpen/><span>Documentation</span><ExternalLink className="tiny"/></button><button className="nav-item"><CircleHelp/><span>Help center</span></button></>}<button className="nav-item"><Settings/>{open&&<span>Settings</span>}</button></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main">
   <header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs"><span>4N DEV</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="icon-btn"><Search/></button><button className="help">Docs</button><div className="profile-wrap"><button className="user" onClick={()=>setProfile(!profile)}><span>DR</span><ChevronDown/></button>{profile&&<div className="profile-menu"><b>Developer</b><small>developer@4ndev.app</small><hr/><button onClick={()=>setActive("Billing")}>Billing & plan</button><button>Account settings</button><button>Sign out</button></div>}</div></div></header>
   <div className="content">
    <div className="page-head"><div><p className="kicker">DEVELOPER PLATFORM</p><h1>{active}</h1><p className="subtitle">Build with the 4N DEV Core API.</p></div><button className="primary"><Plus/> Create API key</button></div>
    <section className="hero"><div><div className="status"><span className="dot"/> All systems operational</div><h2>Everything you need to build with AI.</h2><p>Access 4N DEV Core models, manage credentials, monitor usage and control your workspace from one place.</p><div className="hero-actions"><button className="primary">Explore the API <ExternalLink/></button><button className="secondary" onClick={()=>go("AI services")}>Read documentation</button></div></div><div className="orb"><div className="orb-ring ring1"/><div className="orb-ring ring2"/><div className="orb-core"><Sparkles/></div></div></section>
    <div className="section-title"><div><h3>Workspace</h3><p>Current account and platform activity.</p></div><button className="ghost">View usage <ExternalLink/></button></div>
    <div className="stats"><Stat icon={WalletCards} label="Available credits" value="1,250" note="Resets with your plan"/><Stat icon={Activity} label="API requests" value="2,481" note="This billing period"/><Stat icon={Zap} label="Current plan" value="Pro" note="3,500 credits / month"/><Stat icon={ShieldCheck} label="API status" value="Operational" note="99.99% availability"/></div>
    <div className="grid">
      <section className="card keys"><div className="card-head"><div><h3>API keys</h3><p>Credentials used by your applications.</p></div><button className="secondary small"><Plus/> New key</button></div><div className="key-row"><div className="key-icon"><KeyRound/></div><div className="key-main"><b>Production key</b><span>{showKey?key:'4ndev_sk_live_••••••••••••••••••••••••'}</span></div><button className="icon-btn" onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff/>:<Eye/>}</button><button className="icon-btn"><Copy/></button><button className="icon-btn"><MoreHorizontal/></button></div><div className="card-foot"><span className="live-dot"/> Active · Created today</div></section>
      <section className="card"><div className="card-head"><div><h3>AI services</h3><p>Core capabilities available to your plan.</p></div></div><Service icon={Sparkles} name="Chat" desc="Conversational AI"/><Service icon={Code2} name="Coding" desc="Code generation & analysis"/><Service icon={Image} name="Image" desc="Image generation"/><button className="link-btn">View all services <ExternalLink/></button></section>
    </div>
    <section className="card quick"><div><h3>Quick start</h3><p>Make your first API request in minutes.</p></div><div className="code"><span>Authorization:</span> Bearer <em>4ndev_sk_••••••••</em></div><button className="secondary">View API reference</button></section>
   </div>
  </main>
 </div>
}
function Stat({icon:Icon,label,value,note}){return <div className="stat"><div className="stat-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function Service({icon:Icon,name,desc}){return <div className="service"><div className="service-icon"><Icon/></div><div><b>{name}</b><span>{desc}</span></div><span className="available">Available</span></div>}
createRoot(document.getElementById('root')).render(<App/>);