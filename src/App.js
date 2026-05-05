import { useState, useEffect, useCallback, useRef } from "react";
import { sb } from "./supabase";

const fmt     = (n) => `$${Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`;
const hash    = (s) => btoa(unescape(encodeURIComponent(s+"_cdmx2024")));
const genCode = ()  => Math.random().toString(36).substring(2,8).toUpperCase();

const PRODUCTS_BASE = [
  { id:1, name:"Nissan March",           price:820,   daily:20,   type:"taxi",      badge:"🚕 TAXI CDMX", desc:"Taxi oficial de la CDMX",         referral:82,   imgKey:"img_march" },
  { id:2, name:"Hyundai Grand i10 Sedán",price:2400,  daily:60,   type:"taxi",      badge:"🚕 TAXI CDMX", desc:"Taxi oficial de la CDMX",          referral:240,  imgKey:"img_i10"   },
  { id:3, name:"Nissan Versa",           price:7200,  daily:180,  type:"taxi",      badge:"🚕 TAXI CDMX", desc:"El favorito de los taxistas CDMX",  referral:720,  imgKey:"img_versa" },
  { id:4, name:"Nissan Urvan",           price:25200, daily:720,  type:"ejecutivo", badge:"⭐ EJECUTIVO",  desc:"Transporte ejecutivo y de grupo",   referral:2520, imgKey:"img_urvan" },
  { id:5, name:"Chevrolet Tahoe",        price:75600, daily:2160, type:"ejecutivo", badge:"👑 PREMIUM",    desc:"El máximo lujo ejecutivo",          referral:7560, imgKey:"img_tahoe" },
];

const DEFAULT_IMGS = {
  4: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Nissan_Urvan_E26_%28facelift%2C_NV350%29%2C_front_8.15.19.jpg/640px-Nissan_Urvan_E26_%28facelift%2C_NV350%29%2C_front_8.15.19.jpg",
  5: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/2022_Chevrolet_Tahoe_RST%2C_front_6.27.21.jpg/640px-2022_Chevrolet_Tahoe_RST%2C_front_6.27.21.jpg",
};

const WITHDRAW_AMOUNTS = [50, 100, 300, 1500, 6000, 15000];
const RETENTION = 0.10; // 10%

export default function App() {
  const [user,    setUser]    = useState(undefined);
  const [view,    setView]    = useState("home");
  const [toast,   setToast]   = useState(null);
  const [config,  setConfig]  = useState({});
  const [products,setProducts]= useState(PRODUCTS_BASE);
  const rtRef = useRef(null);

  const toast$ = (msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const loadConfig = useCallback(async()=>{
    const {data} = await sb.from("config").select("*");
    if(!data) return;
    const cfg={};
    data.forEach(r=>{ cfg[r.key]=r.value; });
    setConfig(cfg);
    // Armar productos con imágenes y extras
    let base = PRODUCTS_BASE.map(p=>({
      ...p,
      img: cfg[p.imgKey] || DEFAULT_IMGS[p.id] || null
    }));
    // Productos extra del admin
    try{
      if(cfg.extra_products){
        const extra = JSON.parse(cfg.extra_products);
        // Aplicar overrides de precio/daily/referral si existen
        base = base.map(p=>{
          const ov = cfg[`override_${p.id}`];
          if(ov){ try{ const o=JSON.parse(ov); return {...p,...o}; }catch(e){} }
          return p;
        });
        setProducts([...base,...extra]);
        return;
      }
    }catch(e){}
    // Aplicar overrides aunque no haya extras
    base = base.map(p=>{
      const ov = cfg[`override_${p.id}`];
      if(ov){ try{ const o=JSON.parse(ov); return {...p,...o}; }catch(e){} }
      return p;
    });
    setProducts(base);
  },[]);

  const loadUser = useCallback(async(uid)=>{
    const {data:u} = await sb.from("users").select("*").eq("id",uid).single();
    if(!u){ localStorage.removeItem("uid"); setUser(null); return; }
    const {data:rentals} = await sb.from("rentals").select("*").eq("user_id",uid);
    setUser({...u, rentals:rentals||[]});
    if(rtRef.current) rtRef.current.unsubscribe();
    rtRef.current = sb.channel("u_"+uid)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"users",filter:`id=eq.${uid}`},
        p=>setUser(prev=>prev?{...prev,...p.new,rentals:prev.rentals}:prev))
      .subscribe();
  },[]);

  useEffect(()=>{
    loadConfig();
    const uid=localStorage.getItem("uid");
    if(uid) loadUser(uid); else setUser(null);
    return()=>{ if(rtRef.current) rtRef.current.unsubscribe(); };
  },[loadConfig,loadUser]);

  const refresh=()=>user&&loadUser(user.id);
  const logout=()=>{ localStorage.removeItem("uid"); if(rtRef.current) rtRef.current.unsubscribe(); setUser(null); setView("home"); };

  if(user===undefined) return <Loader/>;
  if(!user) return <Auth onLogin={u=>{localStorage.setItem("uid",u.id);loadUser(u.id);}} toast$={toast$} toast={toast}/>;

  let prizes=[];
  try{ prizes=config.roulette_prizes?JSON.parse(config.roulette_prizes):defaultPrizes(); }
  catch(e){ prizes=defaultPrizes(); }

  return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"'Syne',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      <nav style={{background:"rgba(8,8,14,.97)",borderBottom:"1px solid #FFD70030",padding:"0 14px",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(20px)"}}>
        <div style={{maxWidth:1180,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}} onClick={()=>setView("home")}>
            <span style={{fontSize:22}}>🚖</span>
            <div><div style={{fontWeight:800,fontSize:13,color:"#FFD700",lineHeight:1.1}}>CDMX FLEET</div><div style={{fontSize:9,color:"#555"}}>Taxi & Ejecutivo</div></div>
          </div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
            {[["home","🏠","Inicio"],["rent","🚗","Rentar"],["dashboard","📊","Panel"],["roulette","🎰","Ruleta"],["wallet","💰","Wallet"]].map(([v,ic,lb])=>(
              <button key={v} onClick={()=>setView(v)} className="nb" style={{background:view===v?"#FFD700":"transparent",color:view===v?"#000":"#999",border:view===v?"none":"1px solid #222"}}>
                <span>{ic}</span><span style={{fontSize:9}}>{lb}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#555"}}>Saldo</div><div style={{fontWeight:700,color:"#FFD700",fontFamily:"'Space Mono'",fontSize:13}}>{fmt(user.balance)}</div></div>
            <button onClick={logout} style={{background:"#111",border:"1px solid #222",color:"#777",padding:"5px 9px",borderRadius:7,cursor:"pointer",fontSize:11}}>Salir</button>
          </div>
        </div>
      </nav>
      {toast&&<div style={{position:"fixed",bottom:18,right:18,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700,animation:"su .3s ease"}}>{toast.msg}</div>}
      <div style={{maxWidth:1180,margin:"0 auto",padding:"20px 12px"}}>
        {view==="home"      && <Home      user={user} refresh={refresh} setView={setView} toast$={toast$} products={products}/>}
        {view==="rent"      && <Rent      user={user} refresh={refresh} toast$={toast$}   products={products}/>}
        {view==="dashboard" && <Dashboard user={user} products={products}/>}
        {view==="roulette"  && <Roulette  user={user} refresh={refresh} toast$={toast$}   prizes={prizes}/>}
        {view==="wallet"    && <Wallet    user={user} refresh={refresh} toast$={toast$}   config={config}/>}
      </div>
    </div>
  );
}

const Loader=()=>(<div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{fontSize:48}}>🚖</div><div style={{color:"#FFD700",fontFamily:"sans-serif",fontSize:16}}>Cargando...</div></div>);

function defaultPrizes(){
  return[
    {label:"iPhone 17",amount:0,isPhone:true,color:"#7c3aed",p:0},
    {label:"$10,000",amount:10000,color:"#ff6b35",p:0},
    {label:"$5,000",amount:5000,color:"#FF8C00",p:0},
    {label:"$1,000",amount:1000,color:"#0ea5e9",p:0},
    {label:"$500",amount:500,color:"#FFD700",p:0},
    {label:"$100",amount:100,color:"#00cc66",p:0.01},
    {label:"$50",amount:50,color:"#22d3ee",p:0.01},
    {label:"$20",amount:20,color:"#a78bfa",p:0.04},
    {label:"$10",amount:10,color:"#888",p:0.25},
    {label:"$4",amount:4,color:"#555",p:0.69},
  ];
}

/* ── AUTH ── */
function Auth({onLogin,toast$,toast}){
  const [mode,setMode]=useState("login");
  const [ph,setPh]=useState(""); const [pw,setPw]=useState("");
  const [nm,setNm]=useState(""); const [rc,setRc]=useState("");
  const [busy,setBusy]=useState(false);

  const login=async()=>{
    if(!ph||ph.length<10) return toast$("Teléfono inválido","error");
    if(!pw) return toast$("Ingresa contraseña","error");
    setBusy(true);
    const {data}=await sb.from("users").select("*").eq("phone",ph).eq("password_hash",hash(pw)).single();
    if(!data){toast$("Teléfono o contraseña incorrectos","error");setBusy(false);return;}
    onLogin(data); setBusy(false);
  };

  const register=async()=>{
    if(!ph||ph.length<10) return toast$("Teléfono inválido","error");
    if(!nm.trim())         return toast$("Ingresa tu nombre","error");
    if(!pw||pw.length<6)  return toast$("Contraseña mín. 6 caracteres","error");
    setBusy(true);
    const {data:ex}=await sb.from("users").select("id").eq("phone",ph).single();
    if(ex){toast$("Número ya registrado","error");setBusy(false);return;}
    let refBy=null;
    if(rc.trim()){
      const {data:r}=await sb.from("users").select("id").eq("code",rc.toUpperCase()).single();
      if(!r){toast$("Código inválido","error");setBusy(false);return;}
      refBy=r.id;
    }
    const {data:nu,error}=await sb.from("users").insert({
      phone:ph,name:nm,password_hash:hash(pw),code:genCode(),
      balance:0,earnings:0,referred_by:refBy,referral_count:0,
      last_collect:0,created_at:Date.now(),bank_account:"",bank_name:""
    }).select().single();
    if(error){toast$("Error: "+error.message,"error");setBusy(false);return;}
    if(refBy){
      const {data:ref}=await sb.from("users").select("referral_count").eq("id",refBy).single();
      if(ref) await sb.from("users").update({referral_count:(ref.referral_count||0)+1}).eq("id",refBy);
    }
    onLogin(nu); setBusy(false);
  };

  return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      {toast&&<div style={{position:"fixed",bottom:18,right:18,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700}}>{toast.msg}</div>}
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          <div style={{fontSize:52,marginBottom:10}}>🚖</div>
          <h1 style={{fontWeight:800,fontSize:28,color:"#FFD700",margin:0}}>CDMX FLEET</h1>
          <p style={{color:"#444",marginTop:6,fontSize:13}}>Taxis & Transporte Ejecutivo</p>
        </div>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:20,padding:24}}>
          <div style={{display:"flex",background:"#0a0a0f",borderRadius:12,padding:4,marginBottom:20}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px",background:mode===m?"#FFD700":"transparent",color:mode===m?"#000":"#555",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:14}}>
                {m==="login"?"Iniciar Sesión":"Registrarse"}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="register"&&<input className="inp" placeholder="Nombre completo" value={nm} onChange={e=>setNm(e.target.value)}/>}
            <input className="inp" placeholder="Teléfono (10 dígitos)" value={ph} onChange={e=>setPh(e.target.value.replace(/\D/g,"").slice(0,10))} type="tel"/>
            <input className="inp" placeholder="Contraseña (mín. 6 caracteres)" value={pw} onChange={e=>setPw(e.target.value)} type="password"/>
            {mode==="register"&&<input className="inp" placeholder="Código de invitación (opcional)" value={rc} onChange={e=>setRc(e.target.value)}/>}
            <button onClick={mode==="login"?login:register} disabled={busy} style={{background:busy?"#333":"linear-gradient(135deg,#FFD700,#FF8C00)",color:"#000",border:"none",padding:"14px",borderRadius:12,cursor:busy?"not-allowed":"pointer",fontWeight:800,fontSize:15,fontFamily:"'Syne'",marginTop:4}}>
              {busy?"⏳ Espera...":(mode==="login"?"🔑 Entrar":"🚀 Crear Cuenta")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HOME ── */
function Home({user,refresh,setView,toast$,products}){
  const ms24=86400000,now=Date.now(),el=now-(user.last_collect||0),can=el>=ms24;
  const pct=Math.min(100,(el/ms24)*100),hrs=Math.floor(Math.max(0,ms24-el)/3600000),mins=Math.floor((Math.max(0,ms24-el)%3600000)/60000);
  const rentals=user.rentals||[],td=rentals.reduce((a,r)=>{const p=products.find(x=>x.id===r.product_id);return a+(p?p.daily:0);},0);
  const collect=async()=>{
    if(!can) return toast$(`⏰ Regresa en ${hrs}h ${mins}m`,"error");
    if(!rentals.length) return toast$("Sin vehículos rentados","error");
    await sb.from("users").update({balance:Number(user.balance)+td,earnings:Number(user.earnings)+td,last_collect:Date.now()}).eq("id",user.id);
    refresh(); toast$(`✅ ¡Cobraste ${fmt(td)}!`);
  };
  return(
    <div>
      <div style={{background:"linear-gradient(135deg,#111118,#1a1a2e,#111118)",borderRadius:20,padding:"32px 24px",marginBottom:22,border:"1px solid #FFD70030",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,background:"radial-gradient(circle,#FFD70015,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{fontSize:10,color:"#FFD700",fontWeight:700,letterSpacing:3,marginBottom:5}}>BIENVENIDO DE VUELTA</div>
        <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 5px",background:"linear-gradient(90deg,#fff,#FFD700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{user.name} 👋</h1>
        <p style={{color:"#555",margin:0,fontSize:13}}>{rentals.length} vehículo{rentals.length!==1?"s":""} · {fmt(td)}/día</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:22}}>
        {[{l:"Saldo",v:fmt(user.balance),i:"💰",c:"#FFD700"},{l:"Ganado",v:fmt(user.earnings),i:"📈",c:"#00cc66"},{l:"Código",v:user.code,i:"🔗",c:"#7c3aed"},{l:"Referidos",v:user.referral_count||0,i:"👥",c:"#0ea5e9"}].map(s=>(
          <div key={s.l} style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:7}}>{s.i}</div>
            <div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:14,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#444",marginTop:3}}>{s.l}</div>
          </div>
        ))}
      </div>
      {rentals.length>0&&(
        <div style={{background:"#111118",border:"1px solid #FFD70030",borderRadius:16,padding:20,marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:12}}>
            <div><h2 style={{margin:0,fontSize:16,fontWeight:700}}>💵 Cobro de Ganancias</h2><p style={{margin:"3px 0 0",color:"#444",fontSize:12}}>Disponible cada 24 horas</p></div>
            <button onClick={collect} className={can?"bon":"boff"} style={{padding:"11px 20px",borderRadius:12,border:"none",cursor:can?"pointer":"not-allowed",fontWeight:800,fontSize:13,fontFamily:"'Syne'"}}>{can?`✅ Cobrar ${fmt(td)}`:`⏰ ${hrs}h ${mins}m`}</button>
          </div>
          <div style={{background:"#0a0a0f",borderRadius:5,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:can?"linear-gradient(90deg,#00cc66,#00ff88)":"linear-gradient(90deg,#FFD700,#FF8C00)",borderRadius:5,transition:"width .5s"}}/></div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        {[{i:"🚗",t:"Rentar",d:"Elige tu flota",a:"rent",c:"#FFD700"},{i:"🎰",t:"Ruleta",d:"Gana premios",a:"roulette",c:"#7c3aed"},{i:"💳",t:"Recargar",d:"Deposita",a:"wallet",c:"#0ea5e9"},{i:"📤",t:"Retirar",d:"Solicita retiro",a:"wallet",c:"#00cc66"}].map(c=>(
          <button key={c.t} onClick={()=>setView(c.a)} style={{background:"#111118",border:`1px solid ${c.c}15`,borderRadius:13,padding:"16px 12px",cursor:"pointer",textAlign:"left",transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.c} onMouseLeave={e=>e.currentTarget.style.borderColor=`${c.c}15`}>
            <div style={{fontSize:24,marginBottom:8}}>{c.i}</div><div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{c.t}</div><div style={{color:"#444",fontSize:11}}>{c.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── RENT ── */
function Rent({user,refresh,toast$,products}){
  const [conf,setConf]=useState(null),[busy,setBusy]=useState(false);
  const rentals=user.rentals||[],rented=id=>rentals.some(r=>r.product_id===id);
  const doRent=async p=>{
    if((user.balance||0)<p.price) return toast$(`Saldo insuficiente. Necesitas ${fmt(p.price)}`,"error");
    if(rented(p.id)) return toast$("Ya tienes este vehículo","error");
    setBusy(true);
    await sb.from("rentals").insert({user_id:user.id,product_id:p.id,start_date:Date.now()});
    await sb.from("users").update({balance:Number(user.balance)-p.price}).eq("id",user.id);
    if(user.referred_by){
      const {data:r}=await sb.from("users").select("balance,earnings").eq("id",user.referred_by).single();
      if(r) await sb.from("users").update({balance:Number(r.balance)+p.referral,earnings:Number(r.earnings)+p.referral}).eq("id",user.referred_by);
    }
    await refresh(); setConf(null); setBusy(false);
    toast$(`✅ ¡Rentaste el ${p.name}! +${fmt(p.daily)}/día`);
  };
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px"}}>🚗 Rentar Vehículo</h1>
      <p style={{color:"#444",margin:"0 0 22px",fontSize:13}}>Genera ingresos pasivos cada 24 horas</p>
      <Stitle l="🚕 TAXI CDMX"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14,marginBottom:28}}>
        {products.filter(p=>p.type==="taxi").map(p=><PC key={p.id} p={p} rented={rented(p.id)} onSel={()=>setConf(p)}/>)}
      </div>
      <Stitle l="⭐ EJECUTIVO & PREMIUM" dark/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {products.filter(p=>p.type==="ejecutivo").map(p=><PC key={p.id} p={p} rented={rented(p.id)} onSel={()=>setConf(p)}/>)}
      </div>
      {conf&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#111118",border:"1px solid #2a2a2a",borderRadius:20,padding:28,maxWidth:400,width:"100%"}}>
            <h2 style={{margin:"0 0 5px",fontSize:18}}>Confirmar Alquiler</h2>
            <p style={{color:"#444",margin:"0 0 18px",fontSize:13}}>{conf.name}</p>
            <div style={{background:"#0a0a0f",borderRadius:12,padding:14,marginBottom:18}}>
              {[["Costo",fmt(conf.price),"#FFD700"],["Ganancia/24hrs",`+${fmt(conf.daily)}`,"#00cc66"],["Tu saldo",fmt(user.balance),"#fff"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #111",fontSize:13}}>
                  <span style={{color:"#555"}}>{l}</span><span style={{fontFamily:"'Space Mono'",fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConf(null)} style={{flex:1,padding:"12px",background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'"}}>Cancelar</button>
              <button onClick={()=>doRent(conf)} disabled={busy} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'"}}>{busy?"⏳...":"✅ Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Stitle=({l,dark})=>(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><div style={{background:dark?"#1a1a1a":"#FFD700",border:dark?"1px solid #2a2a2a":"none",borderRadius:7,padding:"4px 11px",fontWeight:800,color:dark?"#fff":"#000",fontSize:10,letterSpacing:1}}>{l}</div><div style={{flex:1,height:1,background:"#1a1a1a"}}/></div>);

const PC=({p,rented,onSel})=>{
  const t=p.type==="taxi";
  return(
    <div style={{background:"#111118",border:`1px solid ${rented?"#00cc6630":"#1a1a1a"}`,borderRadius:16,overflow:"hidden",transition:"transform .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor=t?"#FFD70044":"#3a3a3a";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor=rented?"#00cc6630":"#1a1a1a";}}>
      <div style={{position:"relative",height:180,background:"#181818",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {p.img?<img src={p.img} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>:<div style={{fontSize:48,opacity:.3}}>🚗</div>}
        <div style={{position:"absolute",top:8,left:8,background:t?"#FFD700":"rgba(0,0,0,.8)",border:t?"none":"1px solid #333",color:t?"#000":"#fff",padding:"3px 8px",borderRadius:20,fontSize:9,fontWeight:700}}>{p.badge}</div>
        {rented&&<div style={{position:"absolute",top:8,right:8,background:"#00cc66",color:"#fff",padding:"3px 8px",borderRadius:20,fontSize:9,fontWeight:700}}>✓ RENTADO</div>}
      </div>
      <div style={{padding:"15px 14px"}}>
        <h3 style={{margin:"0 0 3px",fontSize:14,fontWeight:700}}>{p.name}</h3>
        <p style={{color:"#444",fontSize:11,margin:"0 0 12px"}}>{p.desc}</p>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div><div style={{fontSize:9,color:"#444"}}>Inversión</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,color:"#FFD700",fontSize:14}}>{fmt(p.price)}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#444"}}>Ganancia/24h</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,color:"#00cc66",fontSize:14}}>+{fmt(p.daily)}</div></div>
        </div>
        <div style={{background:"#0a0a0f",borderRadius:7,padding:"5px 9px",marginBottom:11,fontSize:10,color:"#444"}}>🔗 Bono referido: <span style={{color:"#7c3aed",fontWeight:700}}>{fmt(p.referral)}</span></div>
        <button onClick={onSel} disabled={rented} style={{width:"100%",padding:"10px",background:rented?"#1a1a1a":"linear-gradient(135deg,#FFD700,#FF8C00)",border:rented?"1px solid #2a2a2a":"none",color:rented?"#333":"#000",borderRadius:9,cursor:rented?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:12}}>{rented?"✓ Ya rentado":"Rentar →"}</button>
      </div>
    </div>
  );
};

/* ── DASHBOARD ── */
function Dashboard({user,products}){
  const rentals=user.rentals||[];
  const td=rentals.reduce((a,r)=>{const p=products.find(x=>x.id===r.product_id);return a+(p?p.daily:0);},0);
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>📊 Mi Panel</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:16,padding:20,gridColumn:"1/-1"}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>🚗 Mis Vehículos</h2>
          {rentals.length===0?<p style={{color:"#333",textAlign:"center",padding:"20px 0",fontSize:13}}>Sin vehículos aún</p>:(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
              {rentals.map(r=>{const p=products.find(x=>x.id===r.product_id);return p?(
                <div key={r.id} style={{background:"#0a0a0f",border:"1px solid #FFD70015",borderRadius:12,overflow:"hidden"}}>
                  {p.img&&<img src={p.img} alt={p.name} style={{width:"100%",height:100,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                  <div style={{padding:10}}><div style={{fontWeight:700,fontSize:12}}>{p.name}</div><div style={{fontSize:10,color:"#444",marginTop:2}}>{new Date(r.start_date).toLocaleDateString("es-MX")}</div><div style={{fontFamily:"'Space Mono'",color:"#00cc66",fontWeight:700,marginTop:5,fontSize:12}}>+{fmt(p.daily)}/día</div></div>
                </div>
              ):null;})}
            </div>
          )}
        </div>
        <div style={{background:"#111118",border:"1px solid #7c3aed20",borderRadius:16,padding:20}}>
          <h2 style={{margin:"0 0 12px",fontSize:15}}>🔗 Mi Código</h2>
          <div style={{background:"#0a0a0f",border:"2px dashed #7c3aed40",borderRadius:12,padding:"14px",textAlign:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Space Mono'",fontSize:22,fontWeight:700,color:"#7c3aed",letterSpacing:4}}>{user.code}</div>
          </div>
          <p style={{color:"#333",fontSize:11,margin:0}}>Comparte y gana 10% · Referidos: <strong style={{color:"#fff"}}>{user.referral_count||0}</strong></p>
        </div>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:16,padding:20}}>
          <h2 style={{margin:"0 0 12px",fontSize:15}}>📋 Estadísticas</h2>
          {[["Saldo actual",fmt(user.balance),"#FFD700"],["Total ganado",fmt(user.earnings),"#00cc66"],["Ganancia del día",fmt(td),"#0ea5e9"],["Vehículos",rentals.length,"#7c3aed"],["Referidos",user.referral_count||0,"#ff6b35"]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #0f0f0f",fontSize:12}}>
              <span style={{color:"#444"}}>{l}</span><span style={{fontFamily:"'Space Mono'",fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ROULETTE ── */
function Roulette({user,refresh,toast$,prizes}){
  const [spinning,setSpin]=useState(false),[ang,setAng]=useState(0),[res,setRes]=useState(null);
  const enabled=user.roulette_enabled===true;
  // Giros vienen SOLO de Supabase — tú los controlas completamente
  const spinsLeft = Number(user.roulette_spins) || 0;
  const seg=360/prizes.length;

  const doSpin=async()=>{
    if(!enabled) return toast$("La ruleta no está activa en tu cuenta","error");
    if(spinsLeft<=0) return toast$("Sin giros disponibles. Pide al administrador que te asigne más","error");

    // 1. Primero descontar el giro en Supabase ANTES de girar
    await sb.from("users").update({roulette_spins: spinsLeft - 1}).eq("id", user.id);

    // 2. Seleccionar premio por probabilidad
    const validPrizes = prizes.filter(p => Number(p.p) > 0);
    if(validPrizes.length === 0) return toast$("No hay premios configurados","error");

    const roll = Math.random();
    let cum = 0;
    let winPrize = validPrizes[validPrizes.length - 1]; // fallback al último válido
    let winIdx = prizes.indexOf(winPrize);

    for(let i = 0; i < prizes.length; i++){
      cum += Number(prizes[i].p) || 0;
      if(roll < cum){
        winPrize = prizes[i];
        winIdx = i;
        break;
      }
    }

    // 3. Calcular ángulo: la rueda dibuja segmento i centrado en (i+0.5)*seg grados
    // La flecha está en la parte superior (ángulo 0 = arriba, que es -90 en Math)
    // Para que el centro del segmento ganador quede arriba necesitamos:
    // rotación = 360*5 (5 vueltas) - (winIdx * seg + seg/2)
    const baseRotation = 360 * 5;
    const prizeAngle = winIdx * seg + seg / 2;
    const finalAngle = baseRotation - prizeAngle;
    setAng(prev => {
      // Normalizamos el ángulo actual y sumamos la rotación necesaria
      const normalized = prev % 360;
      return prev + (finalAngle - normalized + 360) % 360 + 360 * 4;
    });

    setSpin(true); setRes(null);

    setTimeout(async()=>{
      setSpin(false);
      if(winPrize.isPhone){
        setRes({pr:winPrize,win:0,isPhone:true});
        toast$("🎉 ¡Ganaste un iPhone 17! Contacta al admin.");
        refresh();
        return;
      }
      const win = Number(winPrize.amount) || 0;
      if(win > 0){
        await sb.from("users").update({
          balance: Number(user.balance) + win,
          earnings: Number(user.earnings) + win
        }).eq("id", user.id);
        toast$(`🎉 ¡Ganaste ${fmt(win)}!`);
      }
      refresh();
      setRes({pr:winPrize, win});
    }, 4500);
  };

  const buy=async()=>{
    if(!enabled) return toast$("La ruleta no está activa","error");
    if((user.balance||0)<50) return toast$("Saldo insuficiente","error");
    await sb.from("users").update({
      balance: Number(user.balance) - 50,
      roulette_spins: spinsLeft + 1
    }).eq("id", user.id);
    refresh();
    toast$("Compraste 1 giro por $50");
  };

  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px",textAlign:"center"}}>🎰 Ruleta de Premios</h1>
      <p style={{color:"#444",textAlign:"center",margin:"0 0 22px",fontSize:13}}>Gira y gana increíbles premios</p>
      {!enabled?(
        <div style={{background:"#111118",border:"1px solid #FFD70030",borderRadius:18,padding:40,textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:16}}>🔒</div>
          <h2 style={{color:"#FFD700",fontWeight:800,fontSize:20,margin:"0 0 10px"}}>Ruleta No Activa</h2>
          <p style={{color:"#555",fontSize:14,margin:0}}>El administrador debe activar la ruleta para tu cuenta.</p>
        </div>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:22,flexWrap:"wrap"}}>
            <IB l="Giros disponibles" v={spinsLeft} c={spinsLeft>0?"#FFD700":"#ff4444"}/>
            <IB l="Tu saldo" v={fmt(user.balance)} c="#fff"/>
            <button onClick={buy} style={{background:"#111118",border:"1px solid #7c3aed30",color:"#7c3aed",borderRadius:11,padding:"10px 14px",cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11,lineHeight:1.5}}>+ Giro<br/><span style={{fontFamily:"'Space Mono'",fontSize:10}}>$50</span></button>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
            <div style={{position:"relative",width:300,height:300}}>
              <div style={{position:"absolute",top:-15,left:"50%",transform:"translateX(-50%)",fontSize:26,zIndex:10}}>▼</div>
              <svg width="300" height="300" viewBox="0 0 300 300" style={{transform:`rotate(${ang}deg)`,transition:spinning?"transform 4s cubic-bezier(.17,.67,.12,.99)":"none",filter:"drop-shadow(0 0 18px rgba(255,215,0,.2))"}}>
                {prizes.map((p,i)=>{
                  const a1=(i*seg-90)*Math.PI/180,a2=((i+1)*seg-90)*Math.PI/180,cx=150,cy=150,r=140;
                  const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);
                  const mx=cx+(r*.67)*Math.cos((a1+a2)/2),my=cy+(r*.67)*Math.sin((a1+a2)/2);
                  return(<g key={i}><path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}Z`} fill={p.color||"#555"} stroke="#0a0a0f" strokeWidth="2"/><text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={p.label&&p.label.length>6?"8":"10"} fontWeight="800" fontFamily="Syne" transform={`rotate(${i*seg+seg/2+90},${mx},${my})`}>{p.label}</text></g>);
                })}
                <circle cx="150" cy="150" r="20" fill="#0a0a0f" stroke="#FFD700" strokeWidth="3"/>
                <text x="150" y="150" textAnchor="middle" dominantBaseline="middle" fill="#FFD700" fontSize="13">⭐</text>
              </svg>
            </div>
            <button onClick={doSpin} disabled={spinning||spinsLeft<=0} style={{padding:"14px 40px",background:spinning||spinsLeft<=0?"#1a1a1a":"linear-gradient(135deg,#FFD700,#FF8C00)",color:spinning||spinsLeft<=0?"#333":"#000",border:"none",borderRadius:14,cursor:spinning||spinsLeft<=0?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:15}}>
              {spinning?"🎰 Girando...":spinsLeft<=0?"Sin giros disponibles":"🎰 ¡GIRAR!"}
            </button>
            {res&&!spinning&&(
              <div style={{background:"#111118",border:`2px solid ${res.pr.color}`,borderRadius:14,padding:20,textAlign:"center",width:"100%",animation:"su .4s ease"}}>
                <div style={{fontSize:38,marginBottom:7}}>{res.isPhone?"📱":"🎉"}</div>
                <div style={{fontWeight:800,fontSize:19,color:res.pr.color,marginBottom:4}}>¡{res.pr.label}!</div>
                {res.isPhone
                  ?<div style={{color:"#aaa",fontSize:13}}>Contacta al administrador para reclamar tu premio</div>
                  :<div style={{fontFamily:"'Space Mono'",fontSize:16,color:"#00cc66",fontWeight:700}}>+{fmt(res.win)}</div>
                }
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
const IB=({l,v,c})=>(<div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:11,padding:"10px 18px",textAlign:"center"}}><div style={{fontSize:9,color:"#444",marginBottom:2}}>{l}</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:c}}>{v}</div></div>);

/* ── WALLET ── */
function Wallet({user,refresh,toast$,config}){
  const [tab,setTab]=useState("deposit");
  const [depAmt,setDepAmt]=useState("");
  const [proof,setProof]=useState("");
  const [selAmt,setSelAmt]=useState(null);
  const [wb,setWb]=useState(user.bank_name||"");
  const [wac,setWac]=useState(user.bank_account||"");
  const [busy,setBusy]=useState(false);

  const bankName    = config.bank_name    || "Albo";
  const bankHolder  = config.bank_holder  || "Blanca Rosa María";
  const bankAccount = config.bank_account || "721180100035412791";

  const dep=async()=>{
    if(!depAmt||isNaN(depAmt)||Number(depAmt)<=0) return toast$("Monto inválido","error");
    if(!proof.trim()) return toast$("Ingresa referencia/comprobante","error");
    setBusy(true);
    await sb.from("deposits").insert({user_id:user.id,user_name:user.name,user_phone:user.phone,amount:Number(depAmt),proof,status:"pending",created_at:Date.now()});
    setDepAmt(""); setProof(""); setBusy(false);
    toast$("✅ Solicitud enviada. Procesada en <24hrs.");
  };

  const wit=async()=>{
    if(!selAmt) return toast$("Selecciona un monto de retiro","error");
    if(selAmt>(user.balance||0)) return toast$("Saldo insuficiente","error");
    if(!wb.trim()||!wac.trim()) return toast$("Ingresa banco y cuenta","error");
    const net=Math.round(selAmt*(1-RETENTION)*100)/100;
    setBusy(true);
    // Guardar datos bancarios del usuario
    await sb.from("users").update({bank_name:wb,bank_account:wac,balance:Number(user.balance)-selAmt}).eq("id",user.id);
    await sb.from("withdrawals").insert({user_id:user.id,user_name:user.name,user_phone:user.phone,amount:selAmt,net_amount:net,bank:wb,account:wac,status:"pending",created_at:Date.now()});
    refresh(); setSelAmt(null); setBusy(false);
    toast$(`✅ Retiro de ${fmt(selAmt)} solicitado. Recibirás ${fmt(net)} (10% retención).`);
  };

  return(
    <div style={{maxWidth:580,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px"}}>💰 Billetera</h1>
      <div style={{fontFamily:"'Space Mono'",fontSize:26,fontWeight:700,color:"#FFD700",marginBottom:22}}>{fmt(user.balance)}</div>
      <div style={{display:"flex",background:"#111118",borderRadius:14,padding:4,marginBottom:20,border:"1px solid #1e1e1e"}}>
        {[["deposit","💳 Recargar"],["withdraw","📤 Retirar"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",background:tab===t?"#FFD700":"transparent",color:tab===t?"#000":"#444",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:14}}>{l}</button>
        ))}
      </div>

      {tab==="deposit"&&(
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:18,padding:22}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>💳 Recargar Saldo</h2>
          <div style={{background:"linear-gradient(135deg,#1a1a2e,#0f0f1a)",border:"1px solid #FFD70030",borderRadius:13,padding:16,marginBottom:20}}>
            <div style={{fontSize:9,color:"#666",letterSpacing:2,fontWeight:700,marginBottom:10}}>DATOS PARA DEPOSITAR</div>
            {[["Banco",bankName],["Titular",bankHolder],["No. de cuenta",bankAccount]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a1a2e",fontSize:12}}>
                <span style={{color:"#444"}}>{l}</span>
                <span style={{fontWeight:700,color:l.includes("cuenta")?"#FFD700":"#fff",fontFamily:l.includes("cuenta")?"'Space Mono'":"inherit"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <input className="inp" type="number" placeholder="Monto depositado (MXN)" value={depAmt} onChange={e=>setDepAmt(e.target.value)}/>
            <input className="inp" placeholder="Referencia o folio de transferencia" value={proof} onChange={e=>setProof(e.target.value)}/>
            <button onClick={dep} disabled={busy} style={{padding:"13px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:12,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>{busy?"⏳...":"📤 Enviar Comprobante"}</button>
          </div>
        </div>
      )}

      {tab==="withdraw"&&(
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:18,padding:22}}>
          <h2 style={{margin:"0 0 6px",fontSize:15}}>📤 Solicitar Retiro</h2>
          <div style={{background:"#0a0a14",border:"1px solid #FF8C0030",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12}}>
            <div style={{color:"#FF8C00",fontWeight:700,marginBottom:2}}>⏰ Retiros disponibles de 11:00 AM a 5:00 PM</div>
            <div style={{color:"#555"}}>Se aplica una retención del <strong style={{color:"#FFD700"}}>10%</strong> sobre el monto retirado.</div>
          </div>

          {/* MONTOS FIJOS */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"#666",marginBottom:8}}>Selecciona el monto a retirar:</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {WITHDRAW_AMOUNTS.map(amt=>(
                <button key={amt} onClick={()=>setSelAmt(amt)} style={{padding:"12px 6px",background:selAmt===amt?"#FFD700":"#0a0a0f",color:selAmt===amt?"#000":"#aaa",border:`1px solid ${selAmt===amt?"#FFD700":"#2a2a2a"}`,borderRadius:10,cursor:"pointer",fontFamily:"'Space Mono'",fontWeight:700,fontSize:13,transition:"all .15s"}}>
                  {fmt(amt)}
                </button>
              ))}
            </div>
          </div>

          {selAmt&&(
            <div style={{background:"#0a0a0f",borderRadius:10,padding:12,marginBottom:14,fontSize:12}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #111"}}>
                <span style={{color:"#555"}}>Monto solicitado</span><span style={{fontFamily:"'Space Mono'",color:"#fff"}}>{fmt(selAmt)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #111"}}>
                <span style={{color:"#555"}}>Retención 10%</span><span style={{fontFamily:"'Space Mono'",color:"#ff4444"}}>-{fmt(selAmt*RETENTION)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                <span style={{color:"#00cc66",fontWeight:700}}>Recibirás</span><span style={{fontFamily:"'Space Mono'",color:"#00cc66",fontWeight:700}}>{fmt(selAmt*(1-RETENTION))}</span>
              </div>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            {(user.bank_name||user.bank_account)&&(
              <div style={{background:"#0a0a14",border:"1px solid #00cc6620",borderRadius:9,padding:"9px 12px",fontSize:11}}>
                <div style={{color:"#444",marginBottom:3}}>📋 Datos guardados:</div>
                <div style={{color:"#ccc"}}>{user.bank_name} — <span style={{fontFamily:"'Space Mono'",color:"#00cc66"}}>{user.bank_account}</span></div>
              </div>
            )}
            <input className="inp" placeholder="Tu banco (BBVA, HSBC, Albo...)" value={wb} onChange={e=>setWb(e.target.value)}/>
            <input className="inp" placeholder="CLABE o número de cuenta (18 dígitos)" value={wac} onChange={e=>setWac(e.target.value)}/>
          </div>

          <button onClick={wit} disabled={busy||!selAmt} style={{width:"100%",padding:"13px",background:busy||!selAmt?"#1a1a1a":"linear-gradient(135deg,#00cc66,#00ff88)",border:"none",color:busy||!selAmt?"#444":"#000",borderRadius:12,cursor:busy||!selAmt?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>
            {busy?"⏳...":selAmt?`✅ Retirar ${fmt(selAmt)} → Recibes ${fmt(selAmt*(1-RETENTION))}`:"Selecciona un monto"}
          </button>
        </div>
      )}
    </div>
  );
}

const CSS=`*{box-sizing:border-box;}body{margin:0;}.nb{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 8px;border-radius:7px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:600;transition:all .2s;font-size:12px;}.inp{width:100%;padding:11px 13px;background:#0a0a0f;border:1px solid #2a2a2a;color:#fff;border-radius:11px;font-family:'Syne',sans-serif;font-size:13px;outline:none;transition:border-color .2s;display:block;}.inp:focus{border-color:#FFD700;}.inp::placeholder{color:#2a2a2a;}.bon{background:linear-gradient(135deg,#00cc66,#00ff88);color:#000;}.boff{background:#1a1a1a;color:#333;border:1px solid #2a2a2a;}@keyframes su{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#0a0a0f;}::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:3px;}`;
