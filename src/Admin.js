import { useState, useEffect, useCallback, useRef } from "react";
import { sb } from "./supabase";

const ADMIN_PW = "cdmxfleet2024";
const fmt   = n  => `$${Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`;
const fdate = ts => ts?new Date(ts).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}):"—";
const hash  = s  => btoa(unescape(encodeURIComponent(s+"_cdmx2024")));

const DEFAULT_PRIZES = [
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

export default function Admin() {
  const [auth, setAuth]   = useState(false);
  const [pw,   setPw]     = useState("");
  const [err,  setErr]    = useState(false);
  const [view, setView]   = useState("dashboard");
  const [toast,setToast]  = useState(null);
  const [users,       setUsers]       = useState([]);
  const [deposits,    setDeposits]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [config,      setConfig]      = useState({});

  const toast$ = (msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

  const loadConfig = useCallback(async()=>{
    const {data} = await sb.from("config").select("*");
    if(!data) return;
    const cfg={};
    data.forEach(r=>{cfg[r.key]=r.value;});
    setConfig(cfg);
  },[]);

  const saveConfig = async(key,value)=>{
    await sb.from("config").upsert({key,value,updated_at:Date.now()},{onConflict:"key"});
    loadConfig();
  };

  const fetchAll = useCallback(async()=>{
    const [{data:u=[]},{data:d=[]},{data:w=[]},{data:r=[]}] = await Promise.all([
      sb.from("users").select("*").order("created_at",{ascending:false}),
      sb.from("deposits").select("*").order("created_at",{ascending:false}),
      sb.from("withdrawals").select("*").order("created_at",{ascending:false}),
      sb.from("rentals").select("*"),
    ]);
    setUsers((u||[]).map(usr=>({...usr,rentals:(r||[]).filter(rx=>rx.user_id===usr.id)})));
    setDeposits(d||[]); setWithdrawals(w||[]);
  },[]);

  useEffect(()=>{
    if(!auth) return;
    fetchAll(); loadConfig();
    const ch = sb.channel("admin_ch2")
      .on("postgres_changes",{event:"*",schema:"public",table:"deposits"},   fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"withdrawals"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"users"},      fetchAll)
      .subscribe();
    return()=>ch.unsubscribe();
  },[auth,fetchAll,loadConfig]);

  const login=()=>{ if(pw===ADMIN_PW){setAuth(true);setErr(false);}else setErr(true); };

  // ── ACCIONES ──
  const approveDeposit=async d=>{
    const u=users.find(x=>x.id===d.user_id);
    await sb.from("deposits").update({status:"approved"}).eq("id",d.id);
    if(u) await sb.from("users").update({balance:Number(u.balance)+d.amount}).eq("id",d.user_id);
    fetchAll(); toast$(`✅ Depósito de ${fmt(d.amount)} aprobado a ${d.user_name}`);
  };
  const rejectDeposit=async d=>{
    await sb.from("deposits").update({status:"rejected"}).eq("id",d.id);
    fetchAll(); toast$("Depósito rechazado","error");
  };
  const markPaid=async w=>{
    await sb.from("withdrawals").update({status:"paid"}).eq("id",w.id);
    fetchAll(); toast$(`✅ Retiro de ${fmt(w.amount)} marcado como pagado`);
  };
  const adjustBalance=async(uid,amount,note)=>{
    const u=users.find(x=>x.id===uid); if(!u) return;
    await sb.from("users").update({balance:Math.max(0,Number(u.balance)+Number(amount))}).eq("id",uid);
    await sb.from("deposits").insert({user_id:uid,user_name:u.name,user_phone:u.phone,amount:Number(amount),proof:note||"Ajuste manual",status:"approved",created_at:Date.now()});
    fetchAll(); toast$(`Ajuste ${amount>0?"+":""}${fmt(amount)} a ${u.name}`);
  };
  const resetPassword=async(uid,newPw)=>{
    if(!newPw||newPw.length<6) return toast$("Contraseña mín. 6 caracteres","error");
    await sb.from("users").update({password_hash:hash(newPw)}).eq("id",uid);
    toast$("✅ Contraseña restablecida");
  };
  const toggleRoulette=async(uid,current,spins)=>{
    await sb.from("users").update({roulette_enabled:!current,roulette_spins:spins||3}).eq("id",uid);
    fetchAll(); toast$(`Ruleta ${!current?"activada ✅":"desactivada ❌"}`);
  };
  const setSpins=async(uid,spins)=>{
    await sb.from("users").update({roulette_spins:Number(spins)}).eq("id",uid);
    fetchAll(); toast$(`Giros actualizados a ${spins}`);
  };
  const deleteUser=async uid=>{
    if(!window.confirm("¿Eliminar usuario? Es irreversible.")) return;
    await sb.from("rentals").delete().eq("user_id",uid);
    await sb.from("deposits").delete().eq("user_id",uid);
    await sb.from("withdrawals").delete().eq("user_id",uid);
    await sb.from("users").delete().eq("id",uid);
    fetchAll(); toast$("Usuario eliminado","error");
  };

  if(!auth) return(
    <div style={{minHeight:"100vh",background:"#080810",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      <div style={{width:340,background:"#0f0f1a",border:"1px solid #1e1e2e",borderRadius:20,padding:30}}>
        <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:36,marginBottom:8}}>🔐</div><h1 style={{fontWeight:800,fontSize:19,color:"#FFD700",margin:0}}>Panel Admin</h1></div>
        <input className="inp" type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
        {err&&<div style={{color:"#ff4444",fontSize:12,marginTop:4,textAlign:"center"}}>Contraseña incorrecta</div>}
        <button onClick={login} style={{width:"100%",marginTop:12,padding:"12px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>Entrar</button>
      </div>
    </div>
  );

  const pendDep=deposits.filter(d=>d.status==="pending");
  const pendWit=withdrawals.filter(w=>w.status==="pending");
  const nav=[
    ["dashboard","📊","Resumen"],
    ["deposits","💳",pendDep.length?`Recargas (${pendDep.length})`:"Recargas"],
    ["withdrawals","📤",pendWit.length?`Retiros (${pendWit.length})`:"Retiros"],
    ["users","👥","Usuarios"],
    ["products","🚗","Vehículos"],
    ["roulette_cfg","🎰","Ruleta"],
    ["settings","⚙️","Ajustes"],
  ];

  return(
    <div style={{minHeight:"100vh",background:"#080810",color:"#fff",fontFamily:"'Syne',sans-serif",display:"flex"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      {toast&&<div style={{position:"fixed",bottom:16,right:16,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"11px 18px",borderRadius:11,fontWeight:700}}>{toast.msg}</div>}
      <div style={{width:200,background:"#0a0a14",borderRight:"1px solid #141426",padding:"18px 10px",display:"flex",flexDirection:"column",gap:4,flexShrink:0,minHeight:"100vh"}}>
        <div style={{padding:"0 8px 14px",borderBottom:"1px solid #141426",marginBottom:5}}><div style={{fontWeight:800,fontSize:13,color:"#FFD700"}}>🚖 CDMX Fleet</div><div style={{fontSize:9,color:"#444",marginTop:1}}>Administrador</div></div>
        {nav.map(([v,ic,lb])=>(
          <button key={v} onClick={()=>setView(v)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:view===v?"#FFD70012":"transparent",border:view===v?"1px solid #FFD70030":"1px solid transparent",borderRadius:8,cursor:"pointer",color:view===v?"#FFD700":"#555",fontWeight:view===v?700:500,fontFamily:"'Syne'",fontSize:12,textAlign:"left"}}>
            <span>{ic}</span><span>{lb}</span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>setAuth(false)} style={{padding:"9px 10px",background:"transparent",border:"1px solid #141414",borderRadius:8,cursor:"pointer",color:"#444",fontFamily:"'Syne'",fontSize:12,textAlign:"left"}}>🚪 Salir</button>
      </div>
      <div style={{flex:1,padding:"22px 18px",overflowY:"auto"}}>
        {view==="dashboard"    && <ADash   users={users} pendDep={pendDep} pendWit={pendWit}/>}
        {view==="deposits"     && <ADeps   deposits={deposits} approve={approveDeposit} reject={rejectDeposit}/>}
        {view==="withdrawals"  && <AWits   withdrawals={withdrawals} markPaid={markPaid}/>}
        {view==="users"        && <AUsers  users={users} adjust={adjustBalance} del={deleteUser} resetPw={resetPassword} toggleRoulette={toggleRoulette} setSpins={setSpins}/>}
        {view==="products"     && <AProds  users={users} config={config} saveConfig={saveConfig} toast$={toast$}/>}
        {view==="roulette_cfg" && <ARoulette config={config} saveConfig={saveConfig} toast$={toast$}/>}
        {view==="settings"     && <ASettings config={config} saveConfig={saveConfig} toast$={toast$}/>}
      </div>
    </div>
  );
}

/* ── DASHBOARD ── */
function ADash({users,pendDep,pendWit}){
  const total=users.reduce((a,u)=>({bal:a.bal+(u.balance||0),ear:a.ear+(u.earnings||0),r:a.r+(u.rentals||[]).length}),{bal:0,ear:0,r:0});
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>📊 Resumen General</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12,marginBottom:24}}>
        {[{l:"Usuarios",v:users.length,i:"👥",c:"#0ea5e9"},{l:"Saldo total",v:fmt(total.bal),i:"💰",c:"#FFD700"},{l:"Total ganado",v:fmt(total.ear),i:"📈",c:"#00cc66"},{l:"Vehículos activos",v:total.r,i:"🚗",c:"#7c3aed"},{l:"Recargas pendientes",v:pendDep.length,i:"⏳",c:"#FF8C00"},{l:"Retiros pendientes",v:pendWit.length,i:"📤",c:"#ff4444"}].map(s=>(
          <div key={s.l} style={{background:"#0f0f1a",border:`1px solid ${s.c}18`,borderRadius:13,padding:"14px 12px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.i}</div>
            <div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#444",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      {pendDep.length>0&&<Alrt icon="⚠️" msg={`${pendDep.length} recarga(s) pendiente(s)`} c="#FF8C00"/>}
      {pendWit.length>0&&<Alrt icon="💸" msg={`${pendWit.length} retiro(s) pendiente(s)`} c="#ff4444"/>}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:20,marginTop:18}}>
        <h2 style={{margin:"0 0 12px",fontSize:14}}>👥 Últimos registros</h2>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{color:"#444"}}>{["Nombre","Teléfono","Saldo","Vehículos","Ruleta","Registro"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",borderBottom:"1px solid #141426",fontWeight:600}}>{h}</th>)}</tr></thead>
            <tbody>{users.slice(0,10).map(u=>(
              <tr key={u.id}>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",fontWeight:600}}>{u.name}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#555",fontFamily:"'Space Mono'"}}>{u.phone}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#FFD700",fontFamily:"'Space Mono'"}}>{fmt(u.balance)}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#7c3aed"}}>{(u.rentals||[]).length}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:u.roulette_enabled?"#00cc6615":"#ff444415",color:u.roulette_enabled?"#00cc66":"#ff4444",fontWeight:700}}>{u.roulette_enabled?"✓ Activa":"✗ Bloq."}</span></td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#444",fontSize:10}}>{fdate(u.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const Alrt=({icon,msg,c})=>(<div style={{background:`${c}10`,border:`1px solid ${c}40`,borderRadius:10,padding:"11px 15px",display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{fontSize:20}}>{icon}</span><span style={{fontWeight:700,color:c,fontSize:13}}>{msg}</span></div>);

/* ── DEPOSITS ── */
function ADeps({deposits,approve,reject}){
  const [f,setF]=useState("pending");
  const list=deposits.filter(d=>f==="all"||d.status===f);
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 16px"}}>💳 Recargas</h1>
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {[["pending","⏳ Pendientes"],["approved","✅ Aprobadas"],["rejected","❌ Rechazadas"],["all","Todas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setF(v)} style={{padding:"6px 13px",background:f===v?"#FFD700":"#0f0f1a",color:f===v?"#000":"#555",border:"1px solid #141426",borderRadius:7,cursor:"pointer",fontFamily:"'Syne'",fontWeight:600,fontSize:11}}>{l}</button>
        ))}
      </div>
      {list.length===0?<p style={{color:"#444",textAlign:"center",padding:"32px 0"}}>Sin registros</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {list.map(d=>(
            <div key={d.id} style={{background:"#0f0f1a",border:`1px solid ${d.status==="pending"?"#FF8C0030":d.status==="approved"?"#00cc6620":"#ff444420"}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:150}}><div style={{fontWeight:700,fontSize:13}}>{d.user_name}</div><div style={{color:"#444",fontSize:11,fontFamily:"'Space Mono'"}}>{d.user_phone}</div><div style={{color:"#333",fontSize:10,marginTop:2}}>{fdate(d.created_at)}</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:9,color:"#444"}}>Monto</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:"#FFD700"}}>{fmt(d.amount)}</div></div>
              <div style={{flex:1,minWidth:150}}><div style={{fontSize:9,color:"#444",marginBottom:2}}>Comprobante</div><div style={{background:"#0a0a0f",borderRadius:6,padding:"6px 9px",fontSize:11,color:"#ccc",wordBreak:"break-all"}}>{d.proof}</div></div>
              <div>{d.status==="pending"?(
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>approve(d)} style={{padding:"8px 12px",background:"#00cc66",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✓ Aprobar</button>
                  <button onClick={()=>reject(d)}  style={{padding:"8px 12px",background:"#ff4444",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✗ Rechazar</button>
                </div>
              ):(<span style={{padding:"6px 12px",borderRadius:8,fontWeight:700,fontSize:11,background:d.status==="approved"?"#00cc6615":"#ff444415",color:d.status==="approved"?"#00cc66":"#ff4444"}}>{d.status==="approved"?"✓ Aprobado":"✗ Rechazado"}</span>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── WITHDRAWALS ── */
function AWits({withdrawals,markPaid}){
  const [f,setF]=useState("pending");
  const list=withdrawals.filter(w=>f==="all"||(f==="pending"?w.status==="pending":w.status==="paid"));
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 16px"}}>📤 Retiros</h1>
      <div style={{display:"flex",gap:6,marginBottom:18}}>
        {[["pending","⏳ Pendientes"],["paid","✅ Pagados"],["all","Todos"]].map(([v,l])=>(
          <button key={v} onClick={()=>setF(v)} style={{padding:"6px 13px",background:f===v?"#FFD700":"#0f0f1a",color:f===v?"#000":"#555",border:"1px solid #141426",borderRadius:7,cursor:"pointer",fontFamily:"'Syne'",fontWeight:600,fontSize:11}}>{l}</button>
        ))}
      </div>
      {list.length===0?<p style={{color:"#444",textAlign:"center",padding:"32px 0"}}>Sin registros</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {list.map(w=>(
            <div key={w.id} style={{background:"#0f0f1a",border:`1px solid ${w.status!=="paid"?"#ff444428":"#00cc6620"}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:150}}><div style={{fontWeight:700,fontSize:13}}>{w.user_name}</div><div style={{color:"#444",fontSize:11,fontFamily:"'Space Mono'"}}>{w.user_phone}</div><div style={{color:"#333",fontSize:10,marginTop:2}}>{fdate(w.created_at)}</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:9,color:"#444"}}>Monto</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:"#00cc66"}}>{fmt(w.amount)}</div></div>
              <div style={{flex:1,minWidth:150}}><div style={{fontSize:9,color:"#444",marginBottom:2}}>Cuenta destino</div><div style={{background:"#0a0a0f",borderRadius:6,padding:"6px 9px"}}><div style={{fontSize:10,color:"#555"}}>{w.bank}</div><div style={{fontFamily:"'Space Mono'",fontSize:11,color:"#fff",marginTop:1}}>{w.account}</div></div></div>
              <div>{w.status!=="paid"?<button onClick={()=>markPaid(w)} style={{padding:"8px 12px",background:"#00cc66",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✓ Marcar Pagado</button>:<span style={{padding:"6px 12px",borderRadius:8,fontWeight:700,fontSize:11,background:"#00cc6615",color:"#00cc66"}}>✓ Pagado</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── USERS ── */
function AUsers({users,adjust,del,resetPw,toggleRoulette,setSpins}){
  const [q,setQ]=useState(""),[sel,setSel]=useState(null);
  const [adj,setAdj]=useState(""),[note,setNote]=useState("");
  const [newPw,setNewPw]=useState(""),[spinsVal,setSpinsVal]=useState("3");
  const list=users.filter(u=>(u.name||"").toLowerCase().includes(q.toLowerCase())||(u.phone||"").includes(q)||(u.code||"").includes(q.toUpperCase()));
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 16px"}}>👥 Usuarios ({users.length})</h1>
      <input className="inp" placeholder="Buscar nombre, teléfono o código..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:14,maxWidth:380}}/>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(u=>(
          <div key={u.id} style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:170}}>
                <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                <div style={{color:"#444",fontSize:11,fontFamily:"'Space Mono'"}}>{u.phone}</div>
                <div style={{fontSize:10,color:"#333",marginTop:2}}>Código: <span style={{color:"#7c3aed"}}>{u.code}</span></div>
              </div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                {[{l:"Saldo",v:fmt(u.balance),c:"#FFD700"},{l:"Ganado",v:fmt(u.earnings),c:"#00cc66"},{l:"Vehículos",v:(u.rentals||[]).length,c:"#7c3aed"},{l:"Referidos",v:u.referral_count||0,c:"#0ea5e9"}].map(s=>(
                  <div key={s.l} style={{textAlign:"center"}}><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:13,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:"#444",marginTop:1}}>{s.l}</div></div>
                ))}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <button onClick={()=>toggleRoulette(u.id,u.roulette_enabled,u.roulette_spins||3)} style={{padding:"5px 9px",background:u.roulette_enabled?"#00cc6615":"#ff444415",border:`1px solid ${u.roulette_enabled?"#00cc6640":"#ff444440"}`,color:u.roulette_enabled?"#00cc66":"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🎰 {u.roulette_enabled?"Desact.":"Activar"}</button>
                <button onClick={()=>setSel(sel?.id===u.id?null:u)} style={{padding:"5px 9px",background:"#FFD70015",border:"1px solid #FFD70028",color:"#FFD700",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>{sel?.id===u.id?"▲":"✏️"}</button>
                <button onClick={()=>del(u.id)} style={{padding:"5px 9px",background:"#ff444415",border:"1px solid #ff444428",color:"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🗑️</button>
              </div>
            </div>
            {sel?.id===u.id&&(
              <div style={{padding:"16px 14px",borderTop:"1px solid #141426",background:"#0a0a12"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
                  <Sec2 title="💰 Ajustar Saldo">
                    <input className="inp" type="number" placeholder="+suma / -resta" value={adj} onChange={e=>setAdj(e.target.value)} style={{marginBottom:8}}/>
                    <input className="inp" placeholder="Motivo" value={note} onChange={e=>setNote(e.target.value)} style={{marginBottom:8}}/>
                    <Btn onClick={()=>{adjust(u.id,adj,note);setAdj("");setNote("");}} color="#00cc66">Aplicar</Btn>
                  </Sec2>
                  <Sec2 title="🔑 Restablecer Contraseña">
                    <p style={{color:"#444",fontSize:11,margin:"0 0 8px"}}>Escribe una nueva contraseña y dísela al usuario.</p>
                    <input className="inp" placeholder="Nueva contraseña (mín. 6)" value={newPw} onChange={e=>setNewPw(e.target.value)} style={{marginBottom:8}}/>
                    <Btn onClick={()=>{resetPw(u.id,newPw);setNewPw("");}} color="#0ea5e9">Cambiar</Btn>
                  </Sec2>
                  <Sec2 title="🎰 Giros de Ruleta">
                    <p style={{color:"#444",fontSize:11,margin:"0 0 8px"}}>Número de giros disponibles al día: <strong style={{color:"#FFD700"}}>{u.roulette_spins||3}</strong></p>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      {[1,2,3,5,10].map(n=>(
                        <button key={n} onClick={()=>setSpins(u.id,n)} style={{padding:"6px 10px",background:(u.roulette_spins||3)===n?"#FFD700":"#1a1a1a",color:(u.roulette_spins||3)===n?"#000":"#888",border:"1px solid #2a2a2a",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>{n}</button>
                      ))}
                    </div>
                  </Sec2>
                  <Sec2 title="🚗 Vehículos rentados">
                    {(u.rentals||[]).length===0?<p style={{color:"#333",fontSize:12}}>Ninguno</p>:(u.rentals||[]).map(r=>{
                      const names={1:"Nissan March",2:"Hyundai i10",3:"Nissan Versa",4:"Nissan Urvan",5:"Chevrolet Tahoe"};
                      const dailys={1:20,2:60,3:180,4:720,5:2160};
                      return(<div key={r.id} style={{fontSize:12,padding:"4px 0",color:"#ccc",borderBottom:"1px solid #111",display:"flex",justifyContent:"space-between"}}><span>{names[r.product_id]||`ID ${r.product_id}`}</span><span style={{color:"#00cc66"}}>+{fmt(dailys[r.product_id]||0)}/día</span></div>);
                    })}
                  </Sec2>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const Sec2=({title,children})=>(<div style={{background:"#0f0f1a",borderRadius:10,padding:13}}><h3 style={{margin:"0 0 10px",fontSize:12,color:"#888"}}>{title}</h3>{children}</div>);
const Btn=({onClick,color,children})=>(<button onClick={onClick} style={{width:"100%",padding:"8px",background:color,border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>{children}</button>);

/* ── PRODUCTS ── */
function AProds({users,config,saveConfig,toast$}){
  const [newP,setNewP]=useState({name:"",price:"",daily:"",type:"taxi",desc:"",referral:"",img:""});
  const [imgFile,setImgFile]=useState(null);
  const [busy,setBusy]=useState(false);

  let extra=[];
  try{extra=config.extra_products?JSON.parse(config.extra_products):[];}catch(e){}

  const handleImg=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setNewP(p=>({...p,img:ev.target.result}));
    reader.readAsDataURL(file);
    setImgFile(file);
  };

  const addProduct=async()=>{
    if(!newP.name||!newP.price||!newP.daily) return toast$("Nombre, precio y ganancia son obligatorios","error");
    setBusy(true);
    const nextId=100+extra.length+1;
    const product={...newP,id:nextId,price:Number(newP.price),daily:Number(newP.daily),referral:Number(newP.referral)||(Number(newP.price)*.1),badge:newP.type==="taxi"?"🚕 TAXI CDMX":"⭐ EJECUTIVO"};
    const updated=[...extra,product];
    await saveConfig("extra_products",JSON.stringify(updated));
    setNewP({name:"",price:"",daily:"",type:"taxi",desc:"",referral:"",img:""});
    setBusy(false); toast$("✅ Vehículo agregado correctamente");
  };

  const removeProduct=async(id)=>{
    if(!window.confirm("¿Eliminar este vehículo?")) return;
    const updated=extra.filter(p=>p.id!==id);
    await saveConfig("extra_products",JSON.stringify(updated));
    toast$("Vehículo eliminado","error");
  };

  const updateImg=async(key,file)=>{
    const reader=new FileReader();
    reader.onload=async ev=>{
      await saveConfig(key,ev.target.result);
      toast$("✅ Foto actualizada");
    };
    reader.readAsDataURL(file);
  };

  const BASE=[
    {id:1,name:"Nissan March",key:"img_march"},{id:2,name:"Hyundai Grand i10",key:"img_i10"},
    {id:3,name:"Nissan Versa",key:"img_versa"},{id:4,name:"Nissan Urvan",key:null},{id:5,name:"Chevrolet Tahoe",key:null}
  ];

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>🚗 Gestión de Vehículos</h1>

      {/* FOTOS DE CARROS BASE */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginBottom:20}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>📷 Cambiar Fotos de los Carros</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
          {BASE.map(b=>(
            <div key={b.id} style={{background:"#0a0a0f",borderRadius:10,overflow:"hidden",border:"1px solid #1e1e1e"}}>
              <div style={{height:110,background:"#181818",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {b.key&&config[b.key]
                  ? <img src={config[b.key]} alt={b.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <div style={{fontSize:32,opacity:.3}}>🚗</div>
                }
              </div>
              <div style={{padding:10}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>{b.name}</div>
                {b.key?(
                  <label style={{display:"block",padding:"7px",background:"#FFD70018",border:"1px solid #FFD70030",color:"#FFD700",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11,textAlign:"center"}}>
                    📷 Cambiar foto
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&updateImg(b.key,e.target.files[0])}/>
                  </label>
                ):(
                  <div style={{fontSize:10,color:"#444",textAlign:"center"}}>Usa URL externa</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AGREGAR NUEVO */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginBottom:20}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>➕ Agregar Vehículo Nuevo</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:12}}>
          <input className="inp" placeholder="Nombre del vehículo *" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}/>
          <input className="inp" type="number" placeholder="Precio de renta *" value={newP.price} onChange={e=>setNewP(p=>({...p,price:e.target.value}))}/>
          <input className="inp" type="number" placeholder="Ganancia diaria *" value={newP.daily} onChange={e=>setNewP(p=>({...p,daily:e.target.value}))}/>
          <input className="inp" type="number" placeholder="Bono referido (deja vacío = 10%)" value={newP.referral} onChange={e=>setNewP(p=>({...p,referral:e.target.value}))}/>
          <input className="inp" placeholder="Descripción corta" value={newP.desc} onChange={e=>setNewP(p=>({...p,desc:e.target.value}))}/>
          <select className="inp" value={newP.type} onChange={e=>setNewP(p=>({...p,type:e.target.value}))}>
            <option value="taxi">🚕 Taxi CDMX</option>
            <option value="ejecutivo">⭐ Ejecutivo</option>
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"inline-block",padding:"9px 16px",background:"#1a1a2e",border:"1px solid #7c3aed40",color:"#7c3aed",borderRadius:9,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>
            📷 Subir foto del vehículo
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          </label>
          {newP.img&&<span style={{color:"#00cc66",fontSize:11,marginLeft:10}}>✓ Foto lista</span>}
        </div>
        {newP.img&&<img src={newP.img} alt="preview" style={{width:160,height:100,objectFit:"cover",borderRadius:8,marginBottom:12,display:"block"}}/>}
        <button onClick={addProduct} disabled={busy} style={{padding:"10px 24px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>{busy?"⏳...":"➕ Agregar Vehículo"}</button>
      </div>

      {/* LISTA DE EXTRA */}
      {extra.length>0&&(
        <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>📋 Vehículos Agregados por Admin ({extra.length})</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
            {extra.map(p=>(
              <div key={p.id} style={{background:"#0a0a0f",borderRadius:10,overflow:"hidden",border:"1px solid #1e1e1e"}}>
                {p.img&&<img src={p.img} alt={p.name} style={{width:"100%",height:100,objectFit:"cover"}}/>}
                <div style={{padding:10}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#FFD700",fontFamily:"'Space Mono'"}}>{fmt(p.price)}</div>
                  <div style={{fontSize:11,color:"#00cc66",fontFamily:"'Space Mono'"}}>+{fmt(p.daily)}/día</div>
                  <button onClick={()=>removeProduct(p.id)} style={{width:"100%",marginTop:8,padding:"5px",background:"#ff444418",border:"1px solid #ff444430",color:"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🗑️ Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginTop:18}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>📊 Quién rentó cada vehículo</h2>
        {[...BASE.map(b=>({id:b.id,name:b.name})),...extra].map(p=>{
          const rentadores=users.filter(u=>(u.rentals||[]).some(r=>r.product_id===p.id));
          if(rentadores.length===0) return null;
          return(
            <div key={p.id} style={{marginBottom:14,paddingBottom:14,borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:"#FFD700"}}>{p.name} <span style={{color:"#555",fontWeight:400}}>({rentadores.length} activos)</span></div>
              {rentadores.map(u=>(
                <div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",color:"#aaa"}}>
                  <span>{u.name}</span><span style={{fontFamily:"'Space Mono'",color:"#555"}}>{u.phone}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── ROULETTE CONFIG ── */
function ARoulette({config,saveConfig,toast$}){
  let prizes=DEFAULT_PRIZES;
  try{if(config.roulette_prizes)prizes=JSON.parse(config.roulette_prizes);}catch(e){}
  const [local,setLocal]=useState(prizes.map(p=>({...p})));

  const update=(i,field,val)=>{
    setLocal(prev=>{const n=[...prev];n[i]={...n[i],[field]:field==="p"?Number(val):val};return n;});
  };

  const save=async()=>{
    const total=local.reduce((a,p)=>a+p.p,0);
    if(Math.abs(total-1)>0.001) return toast$(`Las probabilidades suman ${(total*100).toFixed(1)}% — deben sumar exactamente 100%`,"error");
    await saveConfig("roulette_prizes",JSON.stringify(local));
    toast$("✅ Premios de ruleta guardados");
  };

  const total=local.reduce((a,p)=>a+p.p,0);

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>🎰 Configurar Ruleta</h1>
      <p style={{color:"#555",fontSize:13,margin:"0 0 20px"}}>Cambia premios y probabilidades. Deben sumar exactamente 100%.</p>

      <div style={{background:"#0f0f1a",border:`1px solid ${Math.abs(total-1)<0.001?"#00cc6640":"#ff444440"}`,borderRadius:10,padding:"10px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,color:"#888"}}>Total probabilidades:</span>
        <span style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:Math.abs(total-1)<0.001?"#00cc66":"#ff4444"}}>{(total*100).toFixed(1)}%</span>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
        {local.map((p,i)=>(
          <div key={i} style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:p.color,flexShrink:0}}/>
            <div style={{fontWeight:700,fontSize:13,minWidth:100,color:p.color}}>{p.label}</div>
            {!p.isPhone&&(
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"#444"}}>$</span>
                <input className="inp" type="number" value={p.amount} onChange={e=>update(i,"amount",Number(e.target.value))} style={{width:90,padding:"6px 10px",fontSize:12}}/>
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
              <span style={{fontSize:11,color:"#444"}}>Prob %:</span>
              <input className="inp" type="number" step="0.01" min="0" max="1" value={p.p} onChange={e=>update(i,"p",e.target.value)} style={{width:70,padding:"6px 10px",fontSize:12}}/>
              <span style={{fontSize:11,color:"#666"}}>= {(p.p*100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} style={{padding:"12px 28px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:12,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>💾 Guardar Premios</button>

      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:10,padding:14,marginTop:18}}>
        <h3 style={{margin:"0 0 8px",fontSize:13,color:"#888"}}>💡 Guía rápida de probabilidades</h3>
        <p style={{fontSize:12,color:"#444",margin:0,lineHeight:1.7}}>
          • El valor es de 0 a 1 donde 1 = 100%<br/>
          • 0 = imposible de salir (para iPhone, $10k, etc.)<br/>
          • 0.01 = 1% de probabilidad<br/>
          • 0.25 = 25% de probabilidad<br/>
          • Todos los valores deben sumar exactamente 1.0 (100%)
        </p>
      </div>
    </div>
  );
}

/* ── SETTINGS ── */
function ASettings({config,saveConfig,toast$}){
  const [bName,setBName]    = useState(config.bank_name    || "Albo");
  const [bHolder,setBHolder]= useState(config.bank_holder  || "Blanca Rosa María");
  const [bAcc,setBAcc]      = useState(config.bank_account || "721180100035412791");
  const [busy,setBusy]      = useState(false);

  const save=async()=>{
    setBusy(true);
    await Promise.all([
      saveConfig("bank_name",   bName),
      saveConfig("bank_holder", bHolder),
      saveConfig("bank_account",bAcc),
    ]);
    setBusy(false);
    toast$("✅ Datos bancarios actualizados en toda la plataforma");
  };

  return(
    <div style={{maxWidth:520}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>⚙️ Ajustes Generales</h1>

      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:20,marginBottom:18}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>🏦 Cuenta Bancaria para Depósitos</h2>
        <p style={{color:"#555",fontSize:12,margin:"0 0 16px"}}>Estos datos se muestran a todos los usuarios cuando van a recargar saldo. Cámbialo aquí y se actualiza en toda la plataforma al instante.</p>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Nombre del banco</label>
            <input className="inp" placeholder="Ej: Albo, BBVA, HSBC..." value={bName} onChange={e=>setBName(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Titular de la cuenta</label>
            <input className="inp" placeholder="Nombre completo del titular" value={bHolder} onChange={e=>setBHolder(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Número de cuenta / CLABE</label>
            <input className="inp" placeholder="Número de cuenta o CLABE interbancaria" value={bAcc} onChange={e=>setBAcc(e.target.value)}/>
          </div>
          <button onClick={save} disabled={busy} style={{padding:"12px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14,marginTop:4}}>
            {busy?"⏳ Guardando...":"💾 Guardar Datos Bancarios"}
          </button>
        </div>
        <div style={{background:"#0a0a0f",borderRadius:10,padding:12,marginTop:14}}>
          <div style={{fontSize:10,color:"#555",marginBottom:6,fontWeight:700}}>VISTA PREVIA — Así lo verán los usuarios:</div>
          {[["Banco",bName],["Titular",bHolder],["No. de cuenta",bAcc]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1a1a1a",fontSize:12}}>
              <span style={{color:"#555"}}>{l}</span><span style={{fontWeight:700,color:l.includes("cuenta")?"#FFD700":"#fff"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS=`*{box-sizing:border-box;}body{margin:0;}.inp{width:100%;padding:10px 12px;background:#0a0a0f;border:1px solid #1e1e2e;color:#fff;border-radius:9px;font-family:'Syne',sans-serif;font-size:12px;outline:none;display:block;transition:border-color .2s;}.inp:focus{border-color:#FFD700;}.inp::placeholder{color:#2a2a2a;}select.inp option{background:#0a0a0f;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080810;}::-webkit-scrollbar-thumb{background:#141426;border-radius:2px;}`;
