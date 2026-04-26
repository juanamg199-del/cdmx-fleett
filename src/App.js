import { useState, useEffect, useCallback, useRef } from "react";
import { sb } from "./supabase";

const PRODUCTS = [
  { id:1, name:"Nissan March",           price:820,   daily:20,   type:"taxi",      badge:"🚕 TAXI CDMX", img:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/2013_Nissan_March_%28K13%29_ST_hatchback_%282015-07-03%29_01.jpg/640px-2013_Nissan_March_%28K13%29_ST_hatchback_%282015-07-03%29_01.jpg",   desc:"Económico y ágil para la ciudad",        referral:82   },
  { id:2, name:"Hyundai Grand i10 Sedán",price:2400,  daily:60,   type:"taxi",      badge:"🚕 TAXI CDMX", img:"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Hyundai_Grand_i10_Sedan_%28facelift%2C_white%29%2C_front_8.28.19.jpg/640px-Hyundai_Grand_i10_Sedan_%28facelift%2C_white%29%2C_front_8.28.19.jpg", desc:"Confort y rendimiento para taxi",         referral:240  },
  { id:3, name:"Nissan Versa",            price:7200,  daily:180,  type:"taxi",      badge:"🚕 TAXI CDMX", img:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/2020_Nissan_Versa_SR%2C_front_10.3.19.jpg/640px-2020_Nissan_Versa_SR%2C_front_10.3.19.jpg",                                                             desc:"El favorito de los taxistas de CDMX",    referral:720  },
  { id:4, name:"Nissan Urvan",            price:25200, daily:720,  type:"ejecutivo", badge:"⭐ EJECUTIVO",  img:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Nissan_Urvan_E26_%28facelift%2C_NV350%29%2C_front_8.15.19.jpg/640px-Nissan_Urvan_E26_%28facelift%2C_NV350%29%2C_front_8.15.19.jpg",                   desc:"Transporte ejecutivo y de grupo",        referral:2520 },
  { id:5, name:"Chevrolet Tahoe",         price:75600, daily:2160, type:"ejecutivo", badge:"👑 PREMIUM",    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/2022_Chevrolet_Tahoe_RST%2C_front_6.27.21.jpg/640px-2022_Chevrolet_Tahoe_RST%2C_front_6.27.21.jpg",                                                   desc:"El máximo lujo en transporte ejecutivo", referral:7560 },
];

const PRIZES = [
  { label:"$50",   amount:50,   color:"#FFD700", p:.20 },
  { label:"$100",  amount:100,  color:"#00cc66", p:.15 },
  { label:"$200",  amount:200,  color:"#0ea5e9", p:.10 },
  { label:"$500",  amount:500,  color:"#7c3aed", p:.05 },
  { label:"$1000", amount:1000, color:"#ff6b35", p:.02 },
  { label:"$20",   amount:20,   color:"#888",    p:.25 },
  { label:"x2",    amount:0, isDouble:true, color:"#ff3366", p:.08 },
  { label:"$30",   amount:30,   color:"#999",    p:.15 },
];

const fmt  = (n) => `$${Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`;
const hash = (s) => btoa(unescape(encodeURIComponent(s+"_cdmx2024")));
const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase();

export default function App() {
  const [user,  setUser]  = useState(undefined);
  const [view,  setView]  = useState("home");
  const [toast, setToast] = useState(null);
  const rtRef = useRef(null);

  const toast$ = (msg, type="success") => {
    setToast({msg,type});
    setTimeout(() => setToast(null), 3500);
  };

  const loadUser = useCallback(async (uid) => {
    const { data: u } = await sb.from("users").select("*").eq("id", uid).single();
    if (!u) { localStorage.removeItem("uid"); setUser(null); return; }
    const { data: rentals } = await sb.from("rentals").select("*").eq("user_id", uid);
    setUser({ ...u, rentals: rentals || [] });
    if (rtRef.current) rtRef.current.unsubscribe();
    rtRef.current = sb.channel("u_"+uid)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"users", filter:`id=eq.${uid}` },
        p => setUser(prev => prev ? { ...prev, ...p.new, rentals: prev.rentals } : prev))
      .subscribe();
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem("uid");
    if (uid) loadUser(uid); else setUser(null);
    return () => { if (rtRef.current) rtRef.current.unsubscribe(); };
  }, [loadUser]);

  const refresh = () => user && loadUser(user.id);
  const logout = () => {
    localStorage.removeItem("uid");
    if (rtRef.current) rtRef.current.unsubscribe();
    setUser(null); setView("home");
  };

  if (user === undefined) return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>🚖</div>
      <div style={{color:"#FFD700",fontFamily:"sans-serif",fontSize:16}}>Cargando CDMX Fleet...</div>
    </div>
  );

  if (!user) return <Auth onLogin={u => { localStorage.setItem("uid", u.id); loadUser(u.id); }} toast$={toast$} toast={toast} />;

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"'Syne',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>

      <nav style={{background:"rgba(8,8,14,.97)",borderBottom:"1px solid #FFD70030",padding:"0 14px",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(20px)"}}>
        <div style={{maxWidth:1180,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}} onClick={() => setView("home")}>
            <span style={{fontSize:22}}>🚖</span>
            <div><div style={{fontWeight:800,fontSize:13,color:"#FFD700",lineHeight:1.1}}>CDMX FLEET</div><div style={{fontSize:9,color:"#555"}}>Taxi & Ejecutivo</div></div>
          </div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
            {[["home","🏠","Inicio"],["rent","🚗","Rentar"],["dashboard","📊","Panel"],["roulette","🎰","Ruleta"],["wallet","💰","Wallet"]].map(([v,ic,lb]) => (
              <button key={v} onClick={() => setView(v)} className="nb" style={{background:view===v?"#FFD700":"transparent",color:view===v?"#000":"#999",border:view===v?"none":"1px solid #222"}}>
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

      {toast && <div style={{position:"fixed",bottom:18,right:18,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700,animation:"su .3s ease"}}>{toast.msg}</div>}

      <div style={{maxWidth:1180,margin:"0 auto",padding:"20px 12px"}}>
        {view==="home"      && <Home      user={user} refresh={refresh} setView={setView} toast$={toast$} />}
        {view==="rent"      && <Rent      user={user} refresh={refresh} toast$={toast$} />}
        {view==="dashboard" && <Dashboard user={user} />}
        {view==="roulette"  && <Roulette  user={user} refresh={refresh} toast$={toast$} />}
        {view==="wallet"    && <Wallet    user={user} refresh={refresh} toast$={toast$} />}
      </div>
    </div>
  );
}

/* ── AUTH ── */
function Auth({ onLogin, toast$, toast }) {
  const [mode,setMode]=useState("login");
  const [ph,setPh]=useState(""); const [pw,setPw]=useState("");
  const [nm,setNm]=useState(""); const [rc,setRc]=useState("");
  const [busy,setBusy]=useState(false);

  const login = async () => {
    if (!ph||ph.length<10) return toast$("Teléfono inválido","error");
    if (!pw) return toast$("Ingresa contraseña","error");
    setBusy(true);
    const { data } = await sb.from("users").select("*").eq("phone",ph).eq("password_hash",hash(pw)).single();
    if (!data) { toast$("Teléfono o contraseña incorrectos","error"); setBusy(false); return; }
    onLogin(data); setBusy(false);
  };

  const register = async () => {
    if (!ph||ph.length<10)  return toast$("Teléfono inválido (10 dígitos)","error");
    if (!nm.trim())          return toast$("Ingresa tu nombre","error");
    if (!pw||pw.length<6)   return toast$("Contraseña mín. 6 caracteres","error");
    setBusy(true);
    const { data: ex } = await sb.from("users").select("id").eq("phone",ph).single();
    if (ex) { toast$("Número ya registrado","error"); setBusy(false); return; }
    let refBy = null;
    if (rc.trim()) {
      const { data: r } = await sb.from("users").select("id").eq("code",rc.toUpperCase()).single();
      if (!r) { toast$("Código de invitación inválido","error"); setBusy(false); return; }
      refBy = r.id;
    }
    const { data: nu, error } = await sb.from("users").insert({
      phone:ph, name:nm, password_hash:hash(pw), code:genCode(),
      balance:0, earnings:0, referred_by:refBy, referral_count:0,
      last_collect:0, created_at:Date.now()
    }).select().single();
    if (error) { toast$("Error: "+error.message,"error"); setBusy(false); return; }
    if (refBy) {
      const { data: ref } = await sb.from("users").select("referral_count").eq("id",refBy).single();
      if (ref) await sb.from("users").update({ referral_count:(ref.referral_count||0)+1 }).eq("id",refBy);
    }
    onLogin(nu); setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      {toast && <div style={{position:"fixed",bottom:18,right:18,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700}}>{toast.msg}</div>}
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          <div style={{fontSize:52,marginBottom:10}}>🚖</div>
          <h1 style={{fontWeight:800,fontSize:28,color:"#FFD700",margin:0}}>CDMX FLEET</h1>
          <p style={{color:"#444",marginTop:6,fontSize:13}}>Taxis & Transporte Ejecutivo</p>
        </div>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:20,padding:24}}>
          <div style={{display:"flex",background:"#0a0a0f",borderRadius:12,padding:4,marginBottom:20}}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{flex:1,padding:"10px",background:mode===m?"#FFD700":"transparent",color:mode===m?"#000":"#555",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:14}}>
                {m==="login" ? "Iniciar Sesión" : "Registrarse"}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="register" && <input className="inp" placeholder="Nombre completo" value={nm} onChange={e=>setNm(e.target.value)}/>}
            <input className="inp" placeholder="Teléfono (10 dígitos)" value={ph} onChange={e=>setPh(e.target.value.replace(/\D/g,"").slice(0,10))} type="tel"/>
            <input className="inp" placeholder="Contraseña (mín. 6 caracteres)" value={pw} onChange={e=>setPw(e.target.value)} type="password"/>
            {mode==="register" && <input className="inp" placeholder="Código de invitación (opcional)" value={rc} onChange={e=>setRc(e.target.value)}/>}
            <button onClick={mode==="login"?login:register} disabled={busy} style={{background:busy?"#333":"linear-gradient(135deg,#FFD700,#FF8C00)",color:"#000",border:"none",padding:"14px",borderRadius:12,cursor:busy?"not-allowed":"pointer",fontWeight:800,fontSize:15,fontFamily:"'Syne'",marginTop:4}}>
              {busy ? "⏳ Espera..." : mode==="login" ? "🔑 Entrar" : "🚀 Crear Cuenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HOME ── */
function Home({ user, refresh, setView, toast$ }) {
  const ms24=86400000, now=Date.now(), el=now-(user.last_collect||0), can=el>=ms24;
  const pct=Math.min(100,(el/ms24)*100), hrs=Math.floor(Math.max(0,ms24-el)/3600000), mins=Math.floor((Math.max(0,ms24-el)%3600000)/60000);
  const rentals=user.rentals||[], td=rentals.reduce((a,r)=>{const p=PRODUCTS.find(x=>x.id===r.product_id);return a+(p?p.daily:0);},0);

  const collect = async () => {
    if (!can) return toast$(`⏰ Regresa en ${hrs}h ${mins}m`,"error");
    if (!rentals.length) return toast$("Sin vehículos rentados","error");
    await sb.from("users").update({ balance:Number(user.balance)+td, earnings:Number(user.earnings)+td, last_collect:Date.now() }).eq("id",user.id);
    refresh(); toast$(`✅ ¡Cobraste ${fmt(td)}!`);
  };

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#111118,#1a1a2e,#111118)",borderRadius:20,padding:"32px 24px",marginBottom:22,border:"1px solid #FFD70030",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,background:"radial-gradient(circle,#FFD70015,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{fontSize:10,color:"#FFD700",fontWeight:700,letterSpacing:3,marginBottom:5}}>BIENVENIDO DE VUELTA</div>
        <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 5px",background:"linear-gradient(90deg,#fff,#FFD700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{user.name} 👋</h1>
        <p style={{color:"#555",margin:0,fontSize:13}}>{rentals.length} vehículo{rentals.length!==1?"s":""} activo{rentals.length!==1?"s":""} · {fmt(td)}/día</p>
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

      {rentals.length>0 && (
        <div style={{background:"#111118",border:"1px solid #FFD70030",borderRadius:16,padding:20,marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:12}}>
            <div><h2 style={{margin:0,fontSize:16,fontWeight:700}}>💵 Cobro de Ganancias</h2><p style={{margin:"3px 0 0",color:"#444",fontSize:12}}>Disponible cada 24 horas</p></div>
            <button onClick={collect} className={can?"bon":"boff"} style={{padding:"11px 20px",borderRadius:12,border:"none",cursor:can?"pointer":"not-allowed",fontWeight:800,fontSize:13,fontFamily:"'Syne'"}}>
              {can ? `✅ Cobrar ${fmt(td)}` : `⏰ ${hrs}h ${mins}m`}
            </button>
          </div>
          <div style={{background:"#0a0a0f",borderRadius:5,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:can?"linear-gradient(90deg,#00cc66,#00ff88)":"linear-gradient(90deg,#FFD700,#FF8C00)",borderRadius:5,transition:"width .5s"}}/></div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        {[{i:"🚗",t:"Rentar",d:"Elige tu flota",a:"rent",c:"#FFD700"},{i:"🎰",t:"Ruleta",d:"Gana monedas",a:"roulette",c:"#7c3aed"},{i:"💳",t:"Recargar",d:"Deposita",a:"wallet",c:"#0ea5e9"},{i:"📤",t:"Retirar",d:"Solicita retiro",a:"wallet",c:"#00cc66"}].map(c=>(
          <button key={c.t} onClick={() => setView(c.a)} style={{background:"#111118",border:`1px solid ${c.c}15`,borderRadius:13,padding:"16px 12px",cursor:"pointer",textAlign:"left",transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.c} onMouseLeave={e=>e.currentTarget.style.borderColor=`${c.c}15`}>
            <div style={{fontSize:24,marginBottom:8}}>{c.i}</div>
            <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{c.t}</div>
            <div style={{color:"#444",fontSize:11}}>{c.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── RENT ── */
function Rent({ user, refresh, toast$ }) {
  const [conf,setConf]=useState(null), [busy,setBusy]=useState(false);
  const rentals=user.rentals||[], rented=id=>rentals.some(r=>r.product_id===id);

  const doRent = async (p) => {
    if ((user.balance||0)<p.price) return toast$(`Saldo insuficiente. Necesitas ${fmt(p.price)}`,"error");
    if (rented(p.id)) return toast$("Ya tienes este vehículo","error");
    setBusy(true);
    await sb.from("rentals").insert({ user_id:user.id, product_id:p.id, start_date:Date.now() });
    await sb.from("users").update({ balance:Number(user.balance)-p.price }).eq("id",user.id);
    if (user.referred_by) {
      const { data: r } = await sb.from("users").select("balance,earnings").eq("id",user.referred_by).single();
      if (r) await sb.from("users").update({ balance:Number(r.balance)+p.referral, earnings:Number(r.earnings)+p.referral }).eq("id",user.referred_by);
    }
    await refresh(); setConf(null); setBusy(false);
    toast$(`✅ ¡Rentaste el ${p.name}! +${fmt(p.daily)}/día`);
  };

  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px"}}>🚗 Rentar Vehículo</h1>
      <p style={{color:"#444",margin:"0 0 22px",fontSize:13}}>Genera ingresos pasivos cada 24 horas</p>
      <Stitle l="🚕 TAXI CDMX"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14,marginBottom:28}}>
        {PRODUCTS.filter(p=>p.type==="taxi").map(p=><PC key={p.id} p={p} rented={rented(p.id)} onSel={()=>setConf(p)}/>)}
      </div>
      <Stitle l="⭐ EJECUTIVO & PREMIUM" dark/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {PRODUCTS.filter(p=>p.type==="ejecutivo").map(p=><PC key={p.id} p={p} rented={rented(p.id)} onSel={()=>setConf(p)}/>)}
      </div>
      {conf && (
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
              <button onClick={()=>doRent(conf)} disabled={busy} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'"}}>
                {busy?"⏳...":"✅ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Stitle = ({l,dark}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
    <div style={{background:dark?"#1a1a1a":"#FFD700",border:dark?"1px solid #2a2a2a":"none",borderRadius:7,padding:"4px 11px",fontWeight:800,color:dark?"#fff":"#000",fontSize:10,letterSpacing:1}}>{l}</div>
    <div style={{flex:1,height:1,background:"#1a1a1a"}}/>
  </div>
);

const PC = ({p,rented,onSel}) => {
  const t=p.type==="taxi";
  return (
    <div style={{background:"#111118",border:`1px solid ${rented?"#00cc6630":"#1a1a1a"}`,borderRadius:16,overflow:"hidden",transition:"transform .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor=t?"#FFD70044":"#3a3a3a";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor=rented?"#00cc6630":"#1a1a1a";}}>
      <div style={{position:"relative",height:180,background:"#181818",overflow:"hidden"}}>
        <img src={p.img} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
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
        <button onClick={onSel} disabled={rented} style={{width:"100%",padding:"10px",background:rented?"#1a1a1a":"linear-gradient(135deg,#FFD700,#FF8C00)",border:rented?"1px solid #2a2a2a":"none",color:rented?"#333":"#000",borderRadius:9,cursor:rented?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:12}}>
          {rented?"✓ Ya rentado":"Rentar →"}
        </button>
      </div>
    </div>
  );
};

/* ── DASHBOARD ── */
function Dashboard({ user }) {
  const rentals=user.rentals||[];
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>📊 Mi Panel</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:16,padding:20,gridColumn:"1/-1"}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>🚗 Mis Vehículos</h2>
          {rentals.length===0 ? <p style={{color:"#333",textAlign:"center",padding:"20px 0",fontSize:13}}>Sin vehículos aún</p> : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
              {rentals.map(r=>{const p=PRODUCTS.find(x=>x.id===r.product_id); return p?(
                <div key={r.id} style={{background:"#0a0a0f",border:"1px solid #FFD70015",borderRadius:12,overflow:"hidden"}}>
                  <img src={p.img} alt={p.name} style={{width:"100%",height:100,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                  <div style={{padding:10}}><div style={{fontWeight:700,fontSize:12}}>{p.name}</div><div style={{fontSize:10,color:"#444",marginTop:2}}>{new Date(r.start_date).toLocaleDateString("es-MX")}</div><div style={{fontFamily:"'Space Mono'",color:"#00cc66",fontWeight:700,marginTop:5,fontSize:12}}>+{fmt(p.daily)}/día</div></div>
                </div>
              ):null;})}
            </div>
          )}
        </div>
        <div style={{background:"#111118",border:"1px solid #7c3aed20",borderRadius:16,padding:20}}>
          <h2 style={{margin:"0 0 12px",fontSize:15}}>🔗 Mi Código de Referido</h2>
          <div style={{background:"#0a0a0f",border:"2px dashed #7c3aed40",borderRadius:12,padding:"14px",textAlign:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Space Mono'",fontSize:22,fontWeight:700,color:"#7c3aed",letterSpacing:4}}>{user.code}</div>
          </div>
          <p style={{color:"#333",fontSize:11,margin:0}}>Comparte y gana 10% · Referidos: <strong style={{color:"#fff"}}>{user.referral_count||0}</strong></p>
        </div>
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:16,padding:20}}>
          <h2 style={{margin:"0 0 12px",fontSize:15}}>📋 Estadísticas</h2>
          {[["Saldo",fmt(user.balance),"#FFD700"],["Total ganado",fmt(user.earnings),"#00cc66"],["Vehículos",rentals.length,"#0ea5e9"],["Referidos",user.referral_count||0,"#7c3aed"]].map(([l,v,c])=>(
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
function Roulette({ user, refresh, toast$ }) {
  const [spinning,setSpin]=useState(false), [ang,setAng]=useState(0), [res,setRes]=useState(null);
  const k=`sp_${user.id}`;
  const [sp,setSp]=useState(()=>{try{const s=JSON.parse(localStorage.getItem(k));if(s&&Date.now()-s.r<86400000)return s;}catch{}return{c:3,r:Date.now()};});
  const saveSp=s=>{setSp(s);localStorage.setItem(k,JSON.stringify(s));};
  const seg=360/PRIZES.length;

  const doSpin = async () => {
    let cur=sp; if(Date.now()-cur.r>=86400000){cur={c:3,r:Date.now()};saveSp(cur);}
    if(cur.c<=0) return toast$("Sin giros. Compra uno o espera mañana","error");
    const roll=Math.random(); let cum=0,idx=0;
    for(let i=0;i<PRIZES.length;i++){cum+=PRIZES[i].p;if(roll<=cum){idx=i;break;}}
    setSpin(true); setRes(null); setAng(a=>a+1800+(seg*idx)+(seg/2));
    saveSp({...cur,c:cur.c-1});
    setTimeout(async()=>{
      setSpin(false); const pr=PRIZES[idx];
      let win=pr.isDouble?Math.round((user.balance||0)*.1*100)/100:pr.amount;
      if(win>0){ await sb.from("users").update({balance:Number(user.balance)+win,earnings:Number(user.earnings)+win}).eq("id",user.id); refresh(); toast$(`🎉 ¡Ganaste ${fmt(win)}!`); }
      setRes({pr,win});
    },4500);
  };

  const buy = async () => {
    if((user.balance||0)<50) return toast$("Saldo insuficiente","error");
    await sb.from("users").update({balance:Number(user.balance)-50}).eq("id",user.id); refresh();
    saveSp({...sp,c:sp.c+1}); toast$("Compraste 1 giro por $50");
  };

  return (
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px",textAlign:"center"}}>🎰 Ruleta de Premios</h1>
      <p style={{color:"#444",textAlign:"center",margin:"0 0 22px",fontSize:13}}>3 giros gratis al día</p>
      <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:22,flexWrap:"wrap"}}>
        <IB l="Giros" v={sp.c} c="#FFD700"/><IB l="Saldo" v={fmt(user.balance)} c="#fff"/>
        <button onClick={buy} style={{background:"#111118",border:"1px solid #7c3aed30",color:"#7c3aed",borderRadius:11,padding:"10px 14px",cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11,lineHeight:1.5}}>+ Giro<br/><span style={{fontFamily:"'Space Mono'",fontSize:10}}>$50</span></button>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
        <div style={{position:"relative",width:280,height:280}}>
          <div style={{position:"absolute",top:-15,left:"50%",transform:"translateX(-50%)",fontSize:24,zIndex:10}}>▼</div>
          <svg width="280" height="280" viewBox="0 0 280 280" style={{transform:`rotate(${ang}deg)`,transition:spinning?"transform 4s cubic-bezier(.17,.67,.12,.99)":"none",filter:"drop-shadow(0 0 16px rgba(255,215,0,.18))"}}>
            {PRIZES.map((p,i)=>{
              const a1=(i*seg-90)*Math.PI/180,a2=((i+1)*seg-90)*Math.PI/180,cx=140,cy=140,r=130;
              const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);
              const mx=cx+(r*.66)*Math.cos((a1+a2)/2),my=cy+(r*.66)*Math.sin((a1+a2)/2);
              return(<g key={i}><path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}Z`} fill={p.color} stroke="#0a0a0f" strokeWidth="2"/><text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="10" fontWeight="800" fontFamily="Syne" transform={`rotate(${i*seg+seg/2+90},${mx},${my})`}>{p.label}</text></g>);
            })}
            <circle cx="140" cy="140" r="19" fill="#0a0a0f" stroke="#FFD700" strokeWidth="3"/>
            <text x="140" y="140" textAnchor="middle" dominantBaseline="middle" fill="#FFD700" fontSize="12">⭐</text>
          </svg>
        </div>
        <button onClick={doSpin} disabled={spinning||sp.c<=0} style={{padding:"14px 40px",background:spinning||sp.c<=0?"#1a1a1a":"linear-gradient(135deg,#FFD700,#FF8C00)",color:spinning||sp.c<=0?"#333":"#000",border:"none",borderRadius:14,cursor:spinning||sp.c<=0?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:15}}>
          {spinning?"🎰 Girando...":"🎰 ¡GIRAR!"}
        </button>
        {res&&!spinning&&(<div style={{background:"#111118",border:`2px solid ${res.pr.color}`,borderRadius:14,padding:20,textAlign:"center",width:"100%",animation:"su .4s ease"}}><div style={{fontSize:38,marginBottom:7}}>🎉</div><div style={{fontWeight:800,fontSize:19,color:res.pr.color,marginBottom:4}}>¡{res.pr.label}!</div><div style={{fontFamily:"'Space Mono'",fontSize:16,color:"#00cc66",fontWeight:700}}>+{fmt(res.win)}</div></div>)}
      </div>
    </div>
  );
}
const IB=({l,v,c})=>(<div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:11,padding:"10px 18px",textAlign:"center"}}><div style={{fontSize:9,color:"#444",marginBottom:2}}>{l}</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:c}}>{v}</div></div>);

/* ── WALLET ── */
function Wallet({ user, refresh, toast$ }) {
  const [tab,setTab]=useState("deposit");
  const [a,setA]=useState(""), [pr,setPr]=useState("");
  const [wa,setWa]=useState(""), [wb,setWb]=useState(""), [wac,setWac]=useState("");
  const [busy,setBusy]=useState(false);

  const dep = async () => {
    if(!a||isNaN(a)||Number(a)<=0) return toast$("Monto inválido","error");
    if(!pr.trim()) return toast$("Ingresa referencia/comprobante","error");
    setBusy(true);
    await sb.from("deposits").insert({user_id:user.id,user_name:user.name,user_phone:user.phone,amount:Number(a),proof:pr,status:"pending",created_at:Date.now()});
    setA(""); setPr(""); setBusy(false);
    toast$("✅ Solicitud enviada. Procesada en <24hrs.");
  };

  const wit = async () => {
    if(!wa||isNaN(wa)||Number(wa)<=0) return toast$("Monto inválido","error");
    if(Number(wa)>(user.balance||0)) return toast$("Saldo insuficiente","error");
    if(!wac.trim()||!wb.trim()) return toast$("Ingresa cuenta y banco","error");
    setBusy(true);
    await sb.from("withdrawals").insert({user_id:user.id,user_name:user.name,user_phone:user.phone,amount:Number(wa),bank:wb,account:wac,status:"pending",created_at:Date.now()});
    await sb.from("users").update({balance:Number(user.balance)-Number(wa)}).eq("id",user.id);
    refresh(); setWa(""); setWb(""); setWac(""); setBusy(false);
    toast$("✅ Retiro solicitado. Se procesa en 24–48hrs.");
  };

  return (
    <div style={{maxWidth:580,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 5px"}}>💰 Billetera</h1>
      <div style={{fontFamily:"'Space Mono'",fontSize:26,fontWeight:700,color:"#FFD700",marginBottom:22}}>{fmt(user.balance)}</div>
      <div style={{display:"flex",background:"#111118",borderRadius:14,padding:4,marginBottom:20,border:"1px solid #1e1e1e"}}>
        {[["deposit","💳 Recargar"],["withdraw","📤 Retirar"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",background:tab===t?"#FFD700":"transparent",color:tab===t?"#000":"#444",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:14}}>{l}</button>
        ))}
      </div>
      {tab==="deposit" && (
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:18,padding:22}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>💳 Recargar Saldo</h2>
          <div style={{background:"linear-gradient(135deg,#1a1a2e,#0f0f1a)",border:"1px solid #FFD70030",borderRadius:13,padding:16,marginBottom:20}}>
            <div style={{fontSize:9,color:"#666",letterSpacing:2,fontWeight:700,marginBottom:10}}>DATOS PARA DEPOSITAR</div>
            {[["Banco","Albo"],["Titular","Blanca Rosa María"],["No. de cuenta","721180100035412791"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a1a2e",fontSize:12}}>
                <span style={{color:"#444"}}>{l}</span><span style={{fontWeight:700,color:l.includes("cuenta")?"#FFD700":"#fff",fontFamily:l.includes("cuenta")?"'Space Mono'":"inherit"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <input className="inp" type="number" placeholder="Monto depositado (MXN)" value={a} onChange={e=>setA(e.target.value)}/>
            <input className="inp" placeholder="Referencia o folio de transferencia" value={pr} onChange={e=>setPr(e.target.value)}/>
            <button onClick={dep} disabled={busy} style={{padding:"13px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:12,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>{busy?"⏳...":"📤 Enviar Comprobante"}</button>
          </div>
        </div>
      )}
      {tab==="withdraw" && (
        <div style={{background:"#111118",border:"1px solid #1e1e1e",borderRadius:18,padding:22}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>📤 Solicitar Retiro</h2>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <div><input className="inp" type="number" placeholder="Monto a retirar" value={wa} onChange={e=>setWa(e.target.value)}/><div style={{fontSize:11,color:"#333",marginTop:4}}>Disponible: {fmt(user.balance)}</div></div>
            <input className="inp" placeholder="Banco (BBVA, HSBC, Albo...)" value={wb} onChange={e=>setWb(e.target.value)}/>
            <input className="inp" placeholder="CLABE o número de cuenta" value={wac} onChange={e=>setWac(e.target.value)}/>
            <button onClick={wit} disabled={busy} style={{padding:"13px",background:"linear-gradient(135deg,#00cc66,#00ff88)",border:"none",color:"#000",borderRadius:12,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>{busy?"⏳...":"✅ Solicitar Retiro"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS=`*{box-sizing:border-box;}body{margin:0;}.nb{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 8px;border-radius:7px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:600;transition:all .2s;font-size:12px;}.inp{width:100%;padding:11px 13px;background:#0a0a0f;border:1px solid #2a2a2a;color:#fff;border-radius:11px;font-family:'Syne',sans-serif;font-size:13px;outline:none;transition:border-color .2s;display:block;}.inp:focus{border-color:#FFD700;}.inp::placeholder{color:#2a2a2a;}.bon{background:linear-gradient(135deg,#00cc66,#00ff88);color:#000;}.boff{background:#1a1a1a;color:#333;border:1px solid #2a2a2a;}@keyframes su{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#0a0a0f;}::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:3px;}`;
