import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app=express();
const PORT=process.env.PORT||10000;
app.use(cors());
app.use(express.json({limit:'1mb'}));

const state={
  workspace:{name:'Personal workspace',account:'Developer',plan:'Pro',credits:1250,monthlyCredits:3500},
  usage:{requests:2481,creditsUsed:2250,successRate:99.8},
  keys:[{id:'key_001',name:'Production key',prefix:'4ndev_sk_live_',createdAt:new Date().toISOString(),active:true}],
  projects:[]
};

function makeKey(){
  return '4ndev_sk_live_'+crypto.randomBytes(24).toString('hex');
}
function auth(req,res,next){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({success:false,error:'Authorization required'});
  req.apiKey=h.slice(7);
  next();
}

app.get('/health',(req,res)=>res.json({success:true,name:'4N DEV Core API V2',status:'online',version:'0.1.0'}));
app.get('/api/dashboard',(req,res)=>res.json({success:true,workspace:state.workspace,usage:state.usage,apiStatus:{status:'operational',availability:'99.99%'},services:[
 {name:'Chat',status:'available',endpoint:'/v1/chat',cost:1},
 {name:'Coding',status:'available',endpoint:'/v1/coding',cost:8},
 {name:'Image',status:'available',endpoint:'/v1/image',cost:50}
]}));
app.get('/api/keys',(req,res)=>res.json({success:true,keys:state.keys.map(k=>({...k,key:undefined}))}));
app.post('/api/keys',(req,res)=>{
 const name=String(req.body?.name||'').trim();
 if(!name) return res.status(400).json({success:false,error:'Key name is required'});
 const key=makeKey();
 const item={id:'key_'+crypto.randomBytes(5).toString('hex'),name,prefix:key.slice(0,16),createdAt:new Date().toISOString(),active:true};
 state.keys.push(item);
 res.status(201).json({success:true,key:{...item,secret:key},warning:'Store the secret securely. It will not be shown again.'});
});
app.post('/api/keys/:id/revoke',(req,res)=>{
 const item=state.keys.find(k=>k.id===req.params.id);
 if(!item)return res.status(404).json({success:false,error:'Key not found'});
 item.active=false;
 res.json({success:true,key:item});
});
app.get('/api/projects',(req,res)=>res.json({success:true,projects:state.projects}));
app.post('/api/projects',(req,res)=>{
 const name=String(req.body?.name||'').trim();
 if(!name)return res.status(400).json({success:false,error:'Project name is required'});
 const project={id:'proj_'+crypto.randomBytes(5).toString('hex'),name,status:'active',createdAt:new Date().toISOString(),apiKeys:0};
 state.projects.push(project);res.status(201).json({success:true,project});
});
app.post('/api/projects/:id/archive',(req,res)=>{const p=state.projects.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({success:false,error:'Project not found'});p.status='archived';res.json({success:true,project:p});});
app.get('/v1/credits',auth,(req,res)=>res.json({success:true,credits:state.workspace.credits,plan:state.workspace.plan}));
app.listen(PORT,()=>console.log('4N DEV Core API V2 running on port '+PORT));