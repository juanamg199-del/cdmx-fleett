import { useState, useEffect, useCallback } from "react";
import { sb } from "./supabase";

const ADMIN_PW = "cdmxfleet2024";
const fmt   = n  => `$${Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`;
const fdate = ts => ts?new Date(ts).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}):"—";
const hash  = s  => btoa(unescape(encodeURIComponent(s+"_cdmx2024")));

const BASE_PRODUCTS = [
  {id:1,name:"Nissan March",          imgKey:"img_march"},
  {id:2,name:"Hyundai Grand i10 Sedán",imgKey:"img_i10"},
  {id:3,name:"Nissan Versa",          imgKey:"img_versa"},
  {id:4,name:"Nissan Urvan",          imgKey:"img_urvan"},
  {id:5,name:"Chevrolet Tahoe",       imgKey:"img_tahoe"},
];

const DEFAULT_PRIZES=[
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

export default function Admin(){
  const [auth,setAuth]=useState(false);
  const [pw,setPw]=useState(""),[err,setErr]=useState(false);
  const [view,setView]=useState("dashboard");
  const [toast,setToast]=useState(null);
  const [users,setUsers]=useState([]);
  const [deposits,setDeposits]=useState([]);
  const [withdrawals,setWithdrawals]=useState([]);
  const [config,setConfig]=useState({});

  const toast$=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

  const loadConfig=useCallback(async()=>{
    const {data}=await sb.from("config").select("*");
    if(!data) return;
    const cfg={};
    data.forEach(r=>{cfg[r.key]=r.value;});
    setConfig(cfg);
  },[]);

  const saveConfig=useCallback(async(key,value)=>{
    const {error}=await sb.from("config").upsert({key,value,updated_at:Date.now()},{onConflict:"key"});
    if(error){ console.error("saveConfig error:",error); return false; }
    await loadConfig();
    return true;
  },[loadConfig]);

  const fetchAll=useCallback(async()=>{
    const [{data:u=[]},{data:d=[]},{data:w=[]},{data:r=[]}]=await Promise.all([
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
    const ch=sb.channel("admin_v2")
      .on("postgres_changes",{event:"*",schema:"public",table:"deposits"},   fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"withdrawals"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"users"},      fetchAll)
      .subscribe();
    return()=>ch.unsubscribe();
  },[auth,fetchAll,loadConfig]);

  const login=()=>{ if(pw===ADMIN_PW){setAuth(true);setErr(false);}else setErr(true); };

  /* ACCIONES */
  const approveDeposit=async d=>{
    const u=users.find(x=>x.id===d.user_id);
    await sb.from("deposits").update({status:"approved"}).eq("id",d.id);
    if(u) await sb.from("users").update({balance:Number(u.balance)+Number(d.amount)}).eq("id",d.user_id);
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
    await sb.from("deposits").insert({user_id:uid,user_name:u.name,user_phone:u.phone,amount:Number(amount),proof:note||"Ajuste manual admin",status:"approved",created_at:Date.now()});
    fetchAll(); toast$(`Ajuste ${amount>0?"+":""}${fmt(amount)} a ${u.name}`);
  };
  const resetPassword=async(uid,newPw)=>{
    if(!newPw||newPw.length<6) return toast$("Contraseña mín. 6 caracteres","error");
    const {error}=await sb.from("users").update({password_hash:hash(newPw)}).eq("id",uid);
    if(error) return toast$("Error al cambiar contraseña","error");
    toast$("✅ Contraseña restablecida correctamente");
  };
  // FIX: activar/desactivar sin perder los giros configurados
  const toggleRoulette=async(uid,current)=>{
    const {error}=await sb.from("users").update({roulette_enabled:!current}).eq("id",uid);
    if(error) return toast$("Error al actualizar","error");
    fetchAll(); toast$(`Ruleta ${!current?"activada ✅":"desactivada ❌"}`);
  };
  // FIX: setear giros directamente, independiente del toggle
  const setSpins=async(uid,spins)=>{
    const {error}=await sb.from("users").update({roulette_spins:Number(spins)}).eq("id",uid);
    if(error) return toast$("Error al actualizar giros","error");
    fetchAll(); toast$(`✅ Giros actualizados a ${spins}`);
  };
  const deleteUser=async uid=>{
    if(!window.confirm("¿Eliminar usuario? Irreversible.")) return;
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
        <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:36,marginBottom:8}}>🔐</div><h1 style={{fontWeight:800,fontSize:19,color:"#FFD700",margin:0}}>Panel Admin</h1><p style={{color:"#444",fontSize:11,margin:"4px 0 0"}}>CDMX Fleet</p></div>
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
      {toast&&<div style={{position:"fixed",bottom:16,right:16,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"11px 18px",borderRadius:11,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>{toast.msg}</div>}
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
        {view==="dashboard"    && <ADash users={users} pendDep={pendDep} pendWit={pendWit} deposits={deposits} withdrawals={withdrawals}/>}
        {view==="deposits"     && <ADeps deposits={deposits} approve={approveDeposit} reject={rejectDeposit}/>}
        {view==="withdrawals"  && <AWits withdrawals={withdrawals} markPaid={markPaid}/>}
        {view==="users"        && <AUsers users={users} deposits={deposits} withdrawals={withdrawals} adjust={adjustBalance} del={deleteUser} resetPw={resetPassword} toggleRoulette={toggleRoulette} setSpins={setSpins}/>}
        {view==="products"     && <AProds users={users} config={config} saveConfig={saveConfig} toast$={toast$}/>}
        {view==="roulette_cfg" && <ARoulette config={config} saveConfig={saveConfig} toast$={toast$}/>}
        {view==="settings"     && <ASettings config={config} saveConfig={saveConfig} toast$={toast$}/>}
      </div>
    </div>
  );
}

/* ── DASHBOARD ── */
function ADash({users,pendDep,pendWit,deposits,withdrawals}){
  const total=users.reduce((a,u)=>({bal:a.bal+(u.balance||0),ear:a.ear+(u.earnings||0),r:a.r+(u.rentals||[]).length}),{bal:0,ear:0,r:0});
  const totalDep=deposits.filter(d=>d.status==="approved").reduce((a,d)=>a+Number(d.amount),0);
  const totalWit=withdrawals.filter(w=>w.status==="paid").reduce((a,w)=>a+Number(w.amount),0);
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>📊 Resumen General</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12,marginBottom:24}}>
        {[
          {l:"Usuarios",v:users.length,i:"👥",c:"#0ea5e9"},
          {l:"Saldo en plataforma",v:fmt(total.bal),i:"💰",c:"#FFD700"},
          {l:"Total ganado usuarios",v:fmt(total.ear),i:"📈",c:"#00cc66"},
          {l:"Vehículos activos",v:total.r,i:"🚗",c:"#7c3aed"},
          {l:"Total depositado",v:fmt(totalDep),i:"💳",c:"#0ea5e9"},
          {l:"Total retirado",v:fmt(totalWit),i:"📤",c:"#ff6b35"},
          {l:"Recargas pendientes",v:pendDep.length,i:"⏳",c:"#FF8C00"},
          {l:"Retiros pendientes",v:pendWit.length,i:"🔴",c:"#ff4444"},
        ].map(s=>(
          <div key={s.l} style={{background:"#0f0f1a",border:`1px solid ${s.c}18`,borderRadius:13,padding:"14px 12px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.i}</div>
            <div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#444",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      {pendDep.length>0&&<Alrt icon="⚠️" msg={`${pendDep.length} recarga(s) pendiente(s) de aprobar`} c="#FF8C00"/>}
      {pendWit.length>0&&<Alrt icon="💸" msg={`${pendWit.length} retiro(s) pendiente(s) de pagar`} c="#ff4444"/>}
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
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:"#444"}}>Solicitado</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:15,color:"#FFD700"}}>{fmt(w.amount)}</div>
                {w.net_amount&&<><div style={{fontSize:9,color:"#444",marginTop:4}}>A pagar (−10%)</div><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:15,color:"#00cc66"}}>{fmt(w.net_amount)}</div></>}
              </div>
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
function AUsers({users,deposits,withdrawals,adjust,del,resetPw,toggleRoulette,setSpins}){
  const [q,setQ]=useState(""),[sel,setSel]=useState(null);
  const [adj,setAdj]=useState(""),[note,setNote]=useState("");
  const [newPw,setNewPw]=useState("");

  const list=users.filter(u=>(u.name||"").toLowerCase().includes(q.toLowerCase())||(u.phone||"").includes(q)||(u.code||"").includes(q.toUpperCase()));

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 16px"}}>👥 Usuarios ({users.length})</h1>
      <input className="inp" placeholder="Buscar nombre, teléfono o código..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:14,maxWidth:380}}/>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(u=>{
          // Totales individuales
          const userDeps=deposits.filter(d=>d.user_id===u.id&&d.status==="approved").reduce((a,d)=>a+Number(d.amount),0);
          const userWits=withdrawals.filter(w=>w.user_id===u.id&&w.status==="paid").reduce((a,w)=>a+Number(w.amount),0);
          const rentals=u.rentals||[];
          const dailyEarning=rentals.reduce((a,r)=>{
            const daily={1:20,2:60,3:180,4:720,5:2160};
            return a+(daily[r.product_id]||0);
          },0);
          return(
            <div key={u.id} style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:12,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:170}}>
                  <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                  <div style={{color:"#444",fontSize:11,fontFamily:"'Space Mono'"}}>{u.phone}</div>
                  <div style={{fontSize:10,color:"#333",marginTop:2}}>Código: <span style={{color:"#7c3aed"}}>{u.code}</span> · {fdate(u.created_at)}</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {[
                    {l:"Saldo",v:fmt(u.balance),c:"#FFD700"},
                    {l:"Ganancias totales",v:fmt(u.earnings),c:"#00cc66"},
                    {l:"Ganancia/día",v:fmt(dailyEarning),c:"#0ea5e9"},
                    {l:"Total depositado",v:fmt(userDeps),c:"#a78bfa"},
                    {l:"Total retirado",v:fmt(userWits),c:"#ff6b35"},
                    {l:"Vehículos",v:rentals.length,c:"#7c3aed"},
                  ].map(s=>(
                    <div key={s.l} style={{textAlign:"center"}}>
                      <div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:12,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:9,color:"#444",marginTop:1}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <button onClick={()=>toggleRoulette(u.id,u.roulette_enabled)} style={{padding:"5px 9px",background:u.roulette_enabled?"#00cc6615":"#ff444415",border:`1px solid ${u.roulette_enabled?"#00cc6640":"#ff444440"}`,color:u.roulette_enabled?"#00cc66":"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>
                    🎰 {u.roulette_enabled?"Desact.":"Activar"}
                  </button>
                  <button onClick={()=>setSel(sel?.id===u.id?null:u)} style={{padding:"5px 9px",background:"#FFD70015",border:"1px solid #FFD70028",color:"#FFD700",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>{sel?.id===u.id?"▲":"✏️"}</button>
                  <button onClick={()=>del(u.id)} style={{padding:"5px 9px",background:"#ff444415",border:"1px solid #ff444428",color:"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🗑️</button>
                </div>
              </div>

              {sel?.id===u.id&&(
                <div style={{padding:"16px 14px",borderTop:"1px solid #141426",background:"#0a0a12"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>

                    {/* AJUSTE SALDO */}
                    <div style={{background:"#0f0f1a",borderRadius:10,padding:13}}>
                      <h3 style={{margin:"0 0 10px",fontSize:12,color:"#FFD700"}}>💰 Ajustar Saldo</h3>
                      <input className="inp" type="number" placeholder="+suma / -resta" value={adj} onChange={e=>setAdj(e.target.value)} style={{marginBottom:7}}/>
                      <input className="inp" placeholder="Motivo" value={note} onChange={e=>setNote(e.target.value)} style={{marginBottom:7}}/>
                      <button onClick={()=>{adjust(u.id,adj,note);setAdj("");setNote("");}} style={{width:"100%",padding:"8px",background:"#00cc66",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>Aplicar</button>
                    </div>

                    {/* CONTRASEÑA */}
                    <div style={{background:"#0f0f1a",borderRadius:10,padding:13}}>
                      <h3 style={{margin:"0 0 6px",fontSize:12,color:"#0ea5e9"}}>🔑 Restablecer Contraseña</h3>
                      <p style={{color:"#444",fontSize:11,margin:"0 0 8px"}}>Escribe la nueva contraseña y dísela al usuario por WhatsApp.</p>
                      <input className="inp" placeholder="Nueva contraseña (mín. 6)" value={newPw} onChange={e=>setNewPw(e.target.value)} style={{marginBottom:7}}/>
                      <button onClick={()=>{resetPw(u.id,newPw);setNewPw("");}} style={{width:"100%",padding:"8px",background:"#0ea5e9",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>🔑 Cambiar Contraseña</button>
                    </div>

                    {/* GIROS RULETA - independiente del toggle */}
                    <div style={{background:"#0f0f1a",borderRadius:10,padding:13}}>
                      <h3 style={{margin:"0 0 6px",fontSize:12,color:"#7c3aed"}}>🎰 Giros de Ruleta</h3>
                      <p style={{color:"#444",fontSize:11,margin:"0 0 8px"}}>Giros actuales: <strong style={{color:"#FFD700"}}>{u.roulette_spins||3}</strong> · Ruleta: <strong style={{color:u.roulette_enabled?"#00cc66":"#ff4444"}}>{u.roulette_enabled?"Activa":"Inactiva"}</strong></p>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[1,2,3,5,10].map(n=>(
                          <button key={n} onClick={()=>setSpins(u.id,n)} style={{padding:"7px 12px",background:(u.roulette_spins||3)===n?"#7c3aed":"#1a1a1a",color:(u.roulette_spins||3)===n?"#fff":"#888",border:"1px solid #2a2a2a",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:13}}>{n}</button>
                        ))}
                      </div>
                      <p style={{color:"#333",fontSize:10,margin:"8px 0 0"}}>Los giros se actualizan inmediatamente sin afectar si la ruleta está activa o no.</p>
                    </div>

                    {/* VEHÍCULOS */}
                    <div style={{background:"#0f0f1a",borderRadius:10,padding:13}}>
                      <h3 style={{margin:"0 0 10px",fontSize:12,color:"#ff6b35"}}>🚗 Vehículos rentados</h3>
                      {(u.rentals||[]).length===0?<p style={{color:"#333",fontSize:12}}>Ninguno</p>:(u.rentals||[]).map(r=>{
                        const names={1:"Nissan March",2:"Hyundai i10",3:"Nissan Versa",4:"Nissan Urvan",5:"Chevrolet Tahoe"};
                        const dailys={1:20,2:60,3:180,4:720,5:2160};
                        return(<div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid #111",color:"#ccc"}}><span>{names[r.product_id]||`ID ${r.product_id}`}</span><span style={{color:"#00cc66",fontFamily:"'Space Mono'"}}>+{fmt(dailys[r.product_id]||0)}/día</span></div>);
                      })}
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── PRODUCTS ── */
function AProds({users,config,saveConfig,toast$}){
  const [newP,setNewP]=useState({name:"",price:"",daily:"",type:"taxi",desc:"",referral:"",img:""});
  const [busy,setBusy]=useState(false);

  let extra=[];
  try{ extra=config.extra_products?JSON.parse(config.extra_products):[]; }catch(e){}

  // Cargar overrides de productos base
  const getOverride=(id)=>{ try{ return config[`override_${id}`]?JSON.parse(config[`override_${id}`]):{};} catch(e){return{};} };

  const handleImg=(setter)=>(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setter(ev.target.result);
    reader.readAsDataURL(file);
  };

  const updateBaseImg=async(key,file)=>{
    const reader=new FileReader();
    reader.onload=async ev=>{
      const ok=await saveConfig(key,ev.target.result);
      if(ok) toast$("✅ Foto actualizada"); else toast$("Error al guardar foto","error");
    };
    reader.readAsDataURL(file);
  };

  const addProduct=async()=>{
    if(!newP.name||!newP.price||!newP.daily) return toast$("Nombre, precio y ganancia son obligatorios","error");
    setBusy(true);
    const nextId=100+extra.length+1;
    const product={...newP,id:nextId,price:Number(newP.price),daily:Number(newP.daily),
      referral:newP.referral?Number(newP.referral):Math.round(Number(newP.price)*0.1),
      badge:newP.type==="taxi"?"🚕 TAXI CDMX":"⭐ EJECUTIVO"};
    const updated=[...extra,product];
    const ok=await saveConfig("extra_products",JSON.stringify(updated));
    if(ok){ setNewP({name:"",price:"",daily:"",type:"taxi",desc:"",referral:"",img:""}); toast$("✅ Vehículo agregado"); }
    else toast$("Error al guardar","error");
    setBusy(false);
  };

  const removeExtra=async(id)=>{
    if(!window.confirm("¿Eliminar este vehículo?")) return;
    const updated=extra.filter(p=>p.id!==id);
    await saveConfig("extra_products",JSON.stringify(updated));
    toast$("Vehículo eliminado","error");
  };

  // Editar precio/ganancia/bono de carros base
  const [editId,setEditId]=useState(null);
  const [editVals,setEditVals]=useState({});

  const openEdit=(p)=>{
    const ov=getOverride(p.id);
    setEditVals({price:ov.price||p.price,daily:ov.daily||p.daily,referral:ov.referral||p.referral});
    setEditId(p.id);
  };
  const saveEdit=async(p)=>{
    const ov={...getOverride(p.id),...editVals,price:Number(editVals.price),daily:Number(editVals.daily),referral:Number(editVals.referral)};
    const ok=await saveConfig(`override_${p.id}`,JSON.stringify(ov));
    if(ok){ setEditId(null); toast$(`✅ ${p.name} actualizado`); } else toast$("Error al guardar","error");
  };

  const BASE_INFO=[
    {id:1,name:"Nissan March",price:820,daily:20,referral:82,imgKey:"img_march"},
    {id:2,name:"Hyundai Grand i10 Sedán",price:2400,daily:60,referral:240,imgKey:"img_i10"},
    {id:3,name:"Nissan Versa",price:7200,daily:180,referral:720,imgKey:"img_versa"},
    {id:4,name:"Nissan Urvan",price:25200,daily:720,referral:2520,imgKey:"img_urvan"},
    {id:5,name:"Chevrolet Tahoe",price:75600,daily:2160,referral:7560,imgKey:"img_tahoe"},
  ];

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>🚗 Gestión de Vehículos</h1>

      {/* CARROS BASE */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginBottom:20}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>✏️ Editar Vehículos Base (foto, precio, ganancia, bono)</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
          {BASE_INFO.map(p=>{
            const ov=getOverride(p.id);
            const curImg=config[p.imgKey];
            return(
              <div key={p.id} style={{background:"#0a0a0f",borderRadius:12,overflow:"hidden",border:"1px solid #1e1e1e"}}>
                <div style={{height:120,background:"#181818",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                  {curImg?<img src={curImg} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{fontSize:36,opacity:.3}}>🚗</div>}
                  <label style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,.7)",border:"1px solid #FFD70060",color:"#FFD700",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                    📷 Cambiar
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&updateBaseImg(p.imgKey,e.target.files[0])}/>
                  </label>
                </div>
                <div style={{padding:12}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{p.name}</div>
                  {editId===p.id?(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",gap:6}}>
                        <div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:3}}>Precio</div><input className="inp" type="number" value={editVals.price} onChange={e=>setEditVals(v=>({...v,price:e.target.value}))} style={{padding:"6px 8px",fontSize:11}}/></div>
                        <div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:3}}>Ganancia/día</div><input className="inp" type="number" value={editVals.daily} onChange={e=>setEditVals(v=>({...v,daily:e.target.value}))} style={{padding:"6px 8px",fontSize:11}}/></div>
                      </div>
                      <div><div style={{fontSize:9,color:"#555",marginBottom:3}}>Bono referido</div><input className="inp" type="number" value={editVals.referral} onChange={e=>setEditVals(v=>({...v,referral:e.target.value}))} style={{padding:"6px 8px",fontSize:11}}/></div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>saveEdit(p)} style={{flex:1,padding:"7px",background:"#00cc66",border:"none",color:"#fff",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✓ Guardar</button>
                        <button onClick={()=>setEditId(null)} style={{flex:1,padding:"7px",background:"#1a1a1a",border:"1px solid #333",color:"#aaa",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✗</button>
                      </div>
                    </div>
                  ):(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                        <span style={{color:"#444"}}>Precio</span><span style={{fontFamily:"'Space Mono'",color:"#FFD700"}}>{fmt(ov.price||p.price)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                        <span style={{color:"#444"}}>Ganancia/día</span><span style={{fontFamily:"'Space Mono'",color:"#00cc66"}}>+{fmt(ov.daily||p.daily)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:8}}>
                        <span style={{color:"#444"}}>Bono referido</span><span style={{fontFamily:"'Space Mono'",color:"#7c3aed"}}>{fmt(ov.referral||p.referral)}</span>
                      </div>
                      <button onClick={()=>openEdit(p)} style={{width:"100%",padding:"7px",background:"#FFD70015",border:"1px solid #FFD70028",color:"#FFD700",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✏️ Editar valores</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AGREGAR NUEVO */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginBottom:20}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>➕ Agregar Vehículo Nuevo</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:12}}>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Nombre *</div><input className="inp" placeholder="Ej: Toyota Corolla" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Precio de renta *</div><input className="inp" type="number" placeholder="Ej: 5000" value={newP.price} onChange={e=>setNewP(p=>({...p,price:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Ganancia diaria *</div><input className="inp" type="number" placeholder="Ej: 150" value={newP.daily} onChange={e=>setNewP(p=>({...p,daily:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Bono referido (vacío = 10%)</div><input className="inp" type="number" placeholder="Ej: 500" value={newP.referral} onChange={e=>setNewP(p=>({...p,referral:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Descripción corta</div><input className="inp" placeholder="Ej: Ideal para ciudad" value={newP.desc} onChange={e=>setNewP(p=>({...p,desc:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:4}}>Tipo</div>
            <select className="inp" value={newP.type} onChange={e=>setNewP(p=>({...p,type:e.target.value}))}>
              <option value="taxi">🚕 Taxi CDMX</option>
              <option value="ejecutivo">⭐ Ejecutivo</option>
            </select>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:"#555",marginBottom:6}}>Foto del vehículo</div>
          <label style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 16px",background:"#1a1a2e",border:"1px solid #7c3aed40",color:"#7c3aed",borderRadius:9,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>
            📷 Subir foto
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImg(img=>setNewP(p=>({...p,img})))}/>
          </label>
          {newP.img&&<span style={{color:"#00cc66",fontSize:11,marginLeft:10}}>✓ Foto lista</span>}
        </div>
        {newP.img&&<img src={newP.img} alt="preview" style={{width:160,height:100,objectFit:"cover",borderRadius:8,marginBottom:12,display:"block"}}/>}
        <button onClick={addProduct} disabled={busy} style={{padding:"10px 24px",background:busy?"#333":"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:busy?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>{busy?"⏳...":"➕ Agregar Vehículo"}</button>
      </div>

      {/* EXTRAS */}
      {extra.length>0&&(
        <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18,marginBottom:20}}>
          <h2 style={{margin:"0 0 14px",fontSize:15}}>📋 Vehículos Extras ({extra.length})</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
            {extra.map(p=>(
              <div key={p.id} style={{background:"#0a0a0f",borderRadius:10,overflow:"hidden",border:"1px solid #1e1e1e"}}>
                {p.img&&<img src={p.img} alt={p.name} style={{width:"100%",height:100,objectFit:"cover"}}/>}
                <div style={{padding:10}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#FFD700",fontFamily:"'Space Mono'"}}>{fmt(p.price)}</div>
                  <div style={{fontSize:11,color:"#00cc66",fontFamily:"'Space Mono'"}}>+{fmt(p.daily)}/día</div>
                  <button onClick={()=>removeExtra(p.id)} style={{width:"100%",marginTop:8,padding:"5px",background:"#ff444418",border:"1px solid #ff444430",color:"#ff4444",borderRadius:6,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🗑️ Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUIÉN RENTÓ QUÉ */}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18}}>
        <h2 style={{margin:"0 0 14px",fontSize:15}}>📊 Quién rentó cada vehículo</h2>
        {[...BASE_INFO,...extra].map(p=>{
          const rentadores=users.filter(u=>(u.rentals||[]).some(r=>r.product_id===p.id));
          if(rentadores.length===0) return null;
          return(
            <div key={p.id} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:"#FFD700"}}>{p.name} <span style={{color:"#555",fontWeight:400}}>({rentadores.length})</span></div>
              {rentadores.map(u=>(
                <div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",color:"#888"}}>
                  <span>{u.name}</span><span style={{fontFamily:"'Space Mono'",color:"#444"}}>{u.phone}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── RULETA CONFIG ── */
function ARoulette({config,saveConfig,toast$}){
  let init=DEFAULT_PRIZES;
  try{ if(config.roulette_prizes) init=JSON.parse(config.roulette_prizes); }catch(e){}
  const [local,setLocal]=useState(init.map(p=>({...p})));
  const update=(i,field,val)=>setLocal(prev=>{const n=[...prev];n[i]={...n[i],[field]:field==="p"?Number(val):val};return n;});
  const total=local.reduce((a,p)=>a+(p.p||0),0);
  const save=async()=>{
    if(Math.abs(total-1)>0.001) return toast$(`Las probabilidades suman ${(total*100).toFixed(1)}% — deben ser exactamente 100%`,"error");
    const ok=await saveConfig("roulette_prizes",JSON.stringify(local));
    if(ok) toast$("✅ Premios guardados"); else toast$("Error al guardar","error");
  };
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>🎰 Configurar Ruleta</h1>
      <p style={{color:"#555",fontSize:13,margin:"0 0 18px"}}>Edita montos y probabilidades. Deben sumar exactamente 100%.</p>
      <div style={{background:"#0f0f1a",border:`1px solid ${Math.abs(total-1)<0.001?"#00cc6640":"#ff444440"}`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,color:"#888"}}>Total probabilidades:</span>
        <span style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:Math.abs(total-1)<0.001?"#00cc66":"#ff4444"}}>{(total*100).toFixed(1)}%</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {local.map((p,i)=>(
          <div key={i} style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:p.color,flexShrink:0}}/>
            <div style={{fontWeight:700,fontSize:13,minWidth:90,color:p.color}}>{p.label}</div>
            {!p.isPhone&&(
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,color:"#444"}}>Monto $</span>
                <input className="inp" type="number" value={p.amount} onChange={e=>update(i,"amount",Number(e.target.value))} style={{width:90,padding:"5px 9px",fontSize:11}}/>
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:"auto"}}>
              <span style={{fontSize:10,color:"#444"}}>Prob (0-1):</span>
              <input className="inp" type="number" step="0.01" min="0" max="1" value={p.p} onChange={e=>update(i,"p",e.target.value)} style={{width:70,padding:"5px 9px",fontSize:11}}/>
              <span style={{fontSize:11,color:"#555",minWidth:40}}>{(p.p*100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} style={{padding:"11px 28px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:12,cursor:"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>💾 Guardar Premios</button>
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:10,padding:13,marginTop:16}}>
        <h3 style={{margin:"0 0 6px",fontSize:12,color:"#888"}}>💡 Guía rápida</h3>
        <p style={{fontSize:11,color:"#444",margin:0,lineHeight:1.8}}>• 0 = imposible (iPhone, $10k, etc.)<br/>• 0.01 = 1% · 0.25 = 25% · 0.69 = 69%<br/>• Todos deben sumar exactamente 1.0 (100%)</p>
      </div>
    </div>
  );
}

/* ── SETTINGS ── */
function ASettings({config,saveConfig,toast$}){
  const [bName,setBName]=useState(config.bank_name||"Albo");
  const [bHolder,setBHolder]=useState(config.bank_holder||"Blanca Rosa María");
  const [bAcc,setBAcc]=useState(config.bank_account||"721180100035412791");
  const [busy,setBusy]=useState(false);

  // Sincronizar cuando config cargue
  useEffect(()=>{
    if(config.bank_name)    setBName(config.bank_name);
    if(config.bank_holder)  setBHolder(config.bank_holder);
    if(config.bank_account) setBAcc(config.bank_account);
  },[config.bank_name,config.bank_holder,config.bank_account]);

  const save=async()=>{
    setBusy(true);
    const results=await Promise.all([
      saveConfig("bank_name",bName),
      saveConfig("bank_holder",bHolder),
      saveConfig("bank_account",bAcc),
    ]);
    setBusy(false);
    if(results.every(Boolean)) toast$("✅ Datos bancarios actualizados para todos los usuarios");
    else toast$("Error al guardar algunos campos","error");
  };

  return(
    <div style={{maxWidth:520}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>⚙️ Ajustes Generales</h1>
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:20}}>
        <h2 style={{margin:"0 0 6px",fontSize:15}}>🏦 Cuenta Bancaria para Depósitos</h2>
        <p style={{color:"#555",fontSize:12,margin:"0 0 18px"}}>Cambia aquí y se actualiza en toda la plataforma al instante. Los usuarios verán estos datos cuando recarguen saldo.</p>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Banco</label>
            <input className="inp" placeholder="Ej: Albo, BBVA, HSBC..." value={bName} onChange={e=>setBName(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Titular de la cuenta</label>
            <input className="inp" placeholder="Nombre completo" value={bHolder} onChange={e=>setBHolder(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Número de cuenta / CLABE</label>
            <input className="inp" placeholder="18 dígitos" value={bAcc} onChange={e=>setBAcc(e.target.value)}/>
          </div>
          <button onClick={save} disabled={busy} style={{padding:"12px",background:busy?"#333":"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",color:"#000",borderRadius:10,cursor:busy?"not-allowed":"pointer",fontWeight:800,fontFamily:"'Syne'",fontSize:14}}>
            {busy?"⏳ Guardando...":"💾 Guardar Datos Bancarios"}
          </button>
        </div>
        <div style={{background:"#0a0a0f",borderRadius:10,padding:12,marginTop:14}}>
          <div style={{fontSize:10,color:"#555",marginBottom:6,fontWeight:700,letterSpacing:1}}>VISTA PREVIA — Así lo verán los usuarios:</div>
          {[["Banco",bName],["Titular",bHolder],["No. de cuenta",bAcc]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1a1a1a",fontSize:12}}>
              <span style={{color:"#555"}}>{l}</span>
              <span style={{fontWeight:700,color:l.includes("cuenta")?"#FFD700":"#fff",fontFamily:l.includes("cuenta")?"'Space Mono'":"inherit"}}>{v||"—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS=`*{box-sizing:border-box;}body{margin:0;}.inp{width:100%;padding:10px 12px;background:#0a0a0f;border:1px solid #1e1e2e;color:#fff;border-radius:9px;font-family:'Syne',sans-serif;font-size:12px;outline:none;display:block;transition:border-color .2s;}.inp:focus{border-color:#FFD700;}.inp::placeholder{color:#2a2a2a;}select.inp option{background:#0a0a0f;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080810;}::-webkit-scrollbar-thumb{background:#141426;border-radius:2px;}`;
