import { useState, useEffect, useCallback } from "react";
import { sb } from "./supabase";

const ADMIN_PW = "cdmxfleet2024"; // ← Cambia tu contraseña aquí

// ============================================================
// 🚗 PRODUCTOS — Debe ser IDÉNTICO al de App.js
// ============================================================
const PRODUCTS = [
  { id:1, name:"Nissan March",           price:820,   daily:20,   referral:82   },
  { id:2, name:"Hyundai Grand i10 Sedán",price:2400,  daily:60,   referral:240  },
  { id:3, name:"Nissan Versa",           price:7200,  daily:180,  referral:720  },
  { id:4, name:"Nissan Urvan",           price:25200, daily:720,  referral:2520 },
  { id:5, name:"Chevrolet Tahoe",        price:75600, daily:2160, referral:7560 },
];

const fmt   = n  => `$${Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`;
const fdate = ts => ts ? new Date(ts).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}) : "—";
const hash  = s  => btoa(unescape(encodeURIComponent(s+"_cdmx2024")));

export default function Admin() {
  const [auth, setAuth]   = useState(false);
  const [pw,   setPw]     = useState("");
  const [err,  setErr]    = useState(false);
  const [view, setView]   = useState("dashboard");
  const [toast,setToast]  = useState(null);
  const [users,       setUsers]       = useState([]);
  const [deposits,    setDeposits]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  const toast$ = (msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

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
    fetchAll();
    const ch = sb.channel("admin_ch")
      .on("postgres_changes",{event:"*",schema:"public",table:"deposits"},   fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"withdrawals"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"users"},      fetchAll)
      .subscribe();
    return()=>ch.unsubscribe();
  },[auth,fetchAll]);

  const login = ()=>{ if(pw===ADMIN_PW){setAuth(true);setErr(false);}else setErr(true); };

  // ── ACCIONES ──
  const approveDeposit = async d=>{
    const u=users.find(x=>x.id===d.user_id);
    await sb.from("deposits").update({status:"approved"}).eq("id",d.id);
    if(u) await sb.from("users").update({balance:Number(u.balance)+d.amount}).eq("id",d.user_id);
    fetchAll(); toast$(`✅ Depósito de ${fmt(d.amount)} aprobado a ${d.user_name}`);
  };
  const rejectDeposit = async d=>{
    await sb.from("deposits").update({status:"rejected"}).eq("id",d.id);
    fetchAll(); toast$("Depósito rechazado","error");
  };
  const markPaid = async w=>{
    await sb.from("withdrawals").update({status:"paid"}).eq("id",w.id);
    fetchAll(); toast$(`✅ Retiro de ${fmt(w.amount)} marcado como pagado`);
  };
  const adjustBalance = async(uid,amount,note)=>{
    const u=users.find(x=>x.id===uid); if(!u) return;
    const newBal = Math.max(0, Number(u.balance)+Number(amount));
    await sb.from("users").update({balance:newBal}).eq("id",uid);
    await sb.from("deposits").insert({user_id:uid,user_name:u.name,user_phone:u.phone,amount:Number(amount),proof:note||"Ajuste manual admin",status:"approved",created_at:Date.now()});
    fetchAll(); toast$(`Ajuste ${amount>0?"+":""}${fmt(amount)} a ${u.name}`);
  };
  const resetPassword = async(uid,newPw)=>{
    if(!newPw||newPw.length<6) return toast$("Contraseña mín. 6 caracteres","error");
    await sb.from("users").update({password_hash:hash(newPw)}).eq("id",uid);
    toast$("✅ Contraseña restablecida correctamente");
  };
  const toggleRoulette = async(uid,current)=>{
    await sb.from("users").update({roulette_enabled:!current}).eq("id",uid);
    fetchAll(); toast$(`Ruleta ${!current?"activada ✅":"desactivada ❌"}`);
  };
  const deleteUser = async uid=>{
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
    ["deposits","💳", pendDep.length?`Recargas (${pendDep.length})`:"Recargas"],
    ["withdrawals","📤",pendWit.length?`Retiros (${pendWit.length})`:"Retiros"],
    ["users","👥","Usuarios"],
    ["products","🚗","Vehículos"],
    ["config","⚙️","Config"],
  ];

  return(
    <div style={{minHeight:"100vh",background:"#080810",color:"#fff",fontFamily:"'Syne',sans-serif",display:"flex"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>
      {toast&&<div style={{position:"fixed",bottom:16,right:16,zIndex:9999,background:toast.type==="error"?"#cc0033":"#00aa55",color:"#fff",padding:"11px 18px",borderRadius:11,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>{toast.msg}</div>}
      <div style={{width:200,background:"#0a0a14",borderRight:"1px solid #141426",padding:"18px 10px",display:"flex",flexDirection:"column",gap:4,flexShrink:0,minHeight:"100vh"}}>
        <div style={{padding:"0 8px 14px",borderBottom:"1px solid #141426",marginBottom:5}}><div style={{fontWeight:800,fontSize:13,color:"#FFD700"}}>🚖 CDMX Fleet</div><div style={{fontSize:9,color:"#444",marginTop:1}}>Administrador</div></div>
        {nav.map(([v,ic,lb])=>(
          <button key={v} onClick={()=>setView(v)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:view===v?"#FFD70012":"transparent",border:view===v?"1px solid #FFD70030":"1px solid transparent",borderRadius:8,cursor:"pointer",color:view===v?"#FFD700":"#555",fontWeight:view===v?700:500,fontFamily:"'Syne'",fontSize:13,textAlign:"left"}}>
            <span>{ic}</span><span>{lb}</span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>setAuth(false)} style={{padding:"9px 10px",background:"transparent",border:"1px solid #141414",borderRadius:8,cursor:"pointer",color:"#444",fontFamily:"'Syne'",fontSize:12,textAlign:"left"}}>🚪 Salir</button>
      </div>
      <div style={{flex:1,padding:"22px 18px",overflowY:"auto"}}>
        {view==="dashboard"   && <ADash   users={users} pendDep={pendDep} pendWit={pendWit}/>}
        {view==="deposits"    && <ADeps   deposits={deposits} approve={approveDeposit} reject={rejectDeposit}/>}
        {view==="withdrawals" && <AWits   withdrawals={withdrawals} markPaid={markPaid}/>}
        {view==="users"       && <AUsers  users={users} adjust={adjustBalance} del={deleteUser} resetPw={resetPassword} toggleRoulette={toggleRoulette}/>}
        {view==="products"    && <AProds  users={users}/>}
        {view==="config"      && <AConfig/>}
      </div>
    </div>
  );
}

/* ── DASHBOARD ── */
function ADash({users,pendDep,pendWit}){
  const totalBal=users.reduce((a,u)=>a+(u.balance||0),0);
  const totalEar=users.reduce((a,u)=>a+(u.earnings||0),0);
  const totalR=users.reduce((a,u)=>a+(u.rentals||[]).length,0);
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 20px"}}>📊 Resumen General</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12,marginBottom:24}}>
        {[{l:"Usuarios",v:users.length,i:"👥",c:"#0ea5e9"},{l:"Saldo total",v:fmt(totalBal),i:"💰",c:"#FFD700"},{l:"Total ganado",v:fmt(totalEar),i:"📈",c:"#00cc66"},{l:"Vehículos activos",v:totalR,i:"🚗",c:"#7c3aed"},{l:"Recargas pendientes",v:pendDep.length,i:"⏳",c:"#FF8C00"},{l:"Retiros pendientes",v:pendWit.length,i:"📤",c:"#ff4444"}].map(s=>(
          <div key={s.l} style={{background:"#0f0f1a",border:`1px solid ${s.c}18`,borderRadius:13,padding:"14px 12px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.i}</div>
            <div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:16,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#444",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      {pendDep.length>0&&<Alrt icon="⚠️" msg={`${pendDep.length} recarga(s) pendiente(s) de aprobar`} c="#FF8C00"/>}
      {pendWit.length>0&&<Alrt icon="💸" msg={`${pendWit.length} retiro(s) pendiente(s) de pagar`} c="#ff4444"/>}
      <div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:20,marginTop:20}}>
        <h2 style={{margin:"0 0 12px",fontSize:14}}>👥 Últimos usuarios registrados</h2>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{color:"#444"}}>{["Nombre","Teléfono","Saldo","Vehículos","Ruleta","Registro"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",borderBottom:"1px solid #141426",fontWeight:600}}>{h}</th>)}</tr></thead>
            <tbody>{users.slice(0,10).map(u=>(
              <tr key={u.id}>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",fontWeight:600}}>{u.name}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#555",fontFamily:"'Space Mono'"}}>{u.phone}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#FFD700",fontFamily:"'Space Mono'"}}>{fmt(u.balance)}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#7c3aed"}}>{(u.rentals||[]).length}</td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:u.roulette_enabled?"#00cc6618":"#ff444418",color:u.roulette_enabled?"#00cc66":"#ff4444",fontWeight:700}}>{u.roulette_enabled?"✓ Activa":"✗ Bloq."}</span></td>
                <td style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a",color:"#444",fontSize:10}}>{fdate(u.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const Alrt=({icon,msg,c})=>(<div style={{background:`${c}10`,border:`1px solid ${c}40`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{fontSize:20}}>{icon}</span><span style={{fontWeight:700,color:c,fontSize:13}}>{msg}</span></div>);

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
              <div style={{flex:1,minWidth:150}}><div style={{fontSize:9,color:"#444",marginBottom:2}}>Comprobante / Referencia</div><div style={{background:"#0a0a0f",borderRadius:6,padding:"6px 9px",fontSize:11,color:"#ccc",wordBreak:"break-all"}}>{d.proof}</div></div>
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
              <div>{w.status!=="paid"?(<button onClick={()=>markPaid(w)} style={{padding:"8px 12px",background:"#00cc66",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:11}}>✓ Marcar Pagado</button>):(<span style={{padding:"6px 12px",borderRadius:8,fontWeight:700,fontSize:11,background:"#00cc6615",color:"#00cc66"}}>✓ Pagado</span>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── USERS ── */
function AUsers({users,adjust,del,resetPw,toggleRoulette}){
  const [q,setQ]=useState(""),[sel,setSel]=useState(null);
  const [adj,setAdj]=useState(""),[note,setNote]=useState("");
  const [newPw,setNewPw]=useState("");

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
                <div style={{fontSize:10,color:"#333",marginTop:2}}>Código: <span style={{color:"#7c3aed"}}>{u.code}</span> · {fdate(u.created_at)}</div>
              </div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                {[{l:"Saldo",v:fmt(u.balance),c:"#FFD700"},{l:"Ganado",v:fmt(u.earnings),c:"#00cc66"},{l:"Vehículos",v:(u.rentals||[]).length,c:"#7c3aed"},{l:"Referidos",v:u.referral_count||0,c:"#0ea5e9"}].map(s=>(
                  <div key={s.l} style={{textAlign:"center"}}><div style={{fontFamily:"'Space Mono'",fontWeight:700,fontSize:13,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:"#444",marginTop:1}}>{s.l}</div></div>
                ))}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {/* RULETA TOGGLE */}
                <button onClick={()=>toggleRoulette(u.id,u.roulette_enabled)} style={{padding:"6px 10px",background:u.roulette_enabled?"#00cc6618":"#ff444418",border:`1px solid ${u.roulette_enabled?"#00cc6640":"#ff444440"}`,color:u.roulette_enabled?"#00cc66":"#ff4444",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>
                  🎰 {u.roulette_enabled?"Desactivar":"Activar"}
                </button>
                <button onClick={()=>setSel(sel?.id===u.id?null:u)} style={{padding:"6px 10px",background:"#FFD70015",border:"1px solid #FFD70028",color:"#FFD700",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>{sel?.id===u.id?"▲":"✏️ Editar"}</button>
                <button onClick={()=>del(u.id)} style={{padding:"6px 10px",background:"#ff444415",border:"1px solid #ff444428",color:"#ff4444",borderRadius:7,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:10}}>🗑️</button>
              </div>
            </div>

            {sel?.id===u.id&&(
              <div style={{padding:"16px 14px",borderTop:"1px solid #141426",background:"#0a0a12"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>

                  {/* AJUSTE DE SALDO */}
                  <div style={{background:"#0f0f1a",borderRadius:12,padding:14}}>
                    <h3 style={{margin:"0 0 10px",fontSize:13,color:"#FFD700"}}>💰 Ajustar Saldo</h3>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <input className="inp" type="number" placeholder="Monto (+suma / -resta)" value={adj} onChange={e=>setAdj(e.target.value)}/>
                      <input className="inp" placeholder="Motivo del ajuste" value={note} onChange={e=>setNote(e.target.value)}/>
                      <button onClick={()=>{adjust(u.id,adj,note);setAdj("");setNote("");}} style={{padding:"9px",background:"#00cc66",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>Aplicar</button>
                    </div>
                  </div>

                  {/* RESTABLECER CONTRASEÑA */}
                  <div style={{background:"#0f0f1a",borderRadius:12,padding:14}}>
                    <h3 style={{margin:"0 0 10px",fontSize:13,color:"#0ea5e9"}}>🔑 Restablecer Contraseña</h3>
                    <p style={{color:"#444",fontSize:11,margin:"0 0 10px"}}>Si el usuario olvidó su contraseña, ponle una nueva aquí y dísela.</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <input className="inp" placeholder="Nueva contraseña (mín. 6 caracteres)" value={newPw} onChange={e=>setNewPw(e.target.value)}/>
                      <button onClick={()=>{resetPw(u.id,newPw);setNewPw("");}} style={{padding:"9px",background:"#0ea5e9",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Syne'",fontSize:12}}>🔑 Cambiar Contraseña</button>
                    </div>
                  </div>

                  {/* VEHÍCULOS */}
                  <div style={{background:"#0f0f1a",borderRadius:12,padding:14}}>
                    <h3 style={{margin:"0 0 10px",fontSize:13,color:"#7c3aed"}}>🚗 Vehículos rentados</h3>
                    {(u.rentals||[]).length===0
                      ? <p style={{color:"#333",fontSize:12}}>Ninguno</p>
                      : (u.rentals||[]).map(r=>{
                          const p=PRODUCTS.find(x=>x.id===r.product_id);
                          return p?(<div key={r.id} style={{fontSize:12,padding:"5px 0",color:"#ccc",borderBottom:"1px solid #111",display:"flex",justifyContent:"space-between"}}><span>{p.name}</span><span style={{color:"#00cc66",fontFamily:"'Space Mono'"}}>+{fmt(p.daily)}/día</span></div>):null;
                        })
                    }
                  </div>

                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PRODUCTS ── */
function AProds({users}){
  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 18px"}}>🚗 Estadísticas por Vehículo</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
        {PRODUCTS.map(p=>{
          // Usuarios que rentaron este vehículo con sus nombres
          const rentadores=users.filter(u=>(u.rentals||[]).some(r=>r.product_id===p.id));
          return(
            <div key={p.id} style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                <div style={{background:"#FFD70015",border:"1px solid #FFD70028",borderRadius:8,padding:"4px 10px",fontFamily:"'Space Mono'",fontSize:11,color:"#FFD700",fontWeight:700}}>{rentadores.length} activos</div>
              </div>
              {[["Precio renta",fmt(p.price),"#FFD700"],["Ganancia/día",fmt(p.daily),"#00cc66"],["Ingreso total",fmt(rentadores.length*p.price),"#0ea5e9"],["Bono referido 10%",fmt(p.referral),"#7c3aed"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid #0f0f0f"}}>
                  <span style={{color:"#555"}}>{l}</span><span style={{fontFamily:"'Space Mono'",fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
              {/* LISTA DE QUIÉNES LO RENTARON */}
              {rentadores.length>0&&(
                <div style={{marginTop:12}}>
                  <div style={{fontSize:10,color:"#444",marginBottom:6,fontWeight:700}}>QUIÉN LO RENTÓ:</div>
                  {rentadores.map(u=>(
                    <div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid #0a0a0a"}}>
                      <span style={{color:"#ccc"}}>{u.name}</span>
                      <span style={{color:"#555",fontFamily:"'Space Mono'"}}>{u.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── CONFIG ── */
function AConfig(){
  return(
    <div style={{maxWidth:600}}>
      <h1 style={{fontSize:22,fontWeight:800,margin:"0 0 22px"}}>⚙️ Guía de Configuración</h1>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        <Sec title="🚗 Cómo agregar un vehículo nuevo">
          <p style={{color:"#666",fontSize:13,margin:"0 0 10px"}}>Abre <code style={{color:"#FFD700"}}>src/App.js</code> en GitHub y agrega un objeto al array <code style={{color:"#FFD700"}}>PRODUCTS</code>:</p>
          <pre style={{background:"#0a0a0f",borderRadius:8,padding:12,color:"#00cc66",fontSize:11,overflowX:"auto",margin:0}}>{`{
  id: 6,                    // Número único
  name: "Nombre del carro",
  price: 10000,             // Costo de renta
  daily: 300,               // Ganancia diaria
  type: "taxi",             // "taxi" o "ejecutivo"
  badge: "🚕 TAXI CDMX",
  desc: "Descripción corta",
  referral: 1000,           // 10% del precio
  img: "URL_de_la_foto",    // Pega la URL de una foto
}`}</pre>
          <p style={{color:"#444",fontSize:11,margin:"10px 0 0"}}>⚠️ También agrégalo en <code style={{color:"#FFD700"}}>src/Admin.js</code> en el array PRODUCTS con el mismo id.</p>
        </Sec>

        <Sec title="🎰 Cómo cambiar premios de la ruleta">
          <p style={{color:"#666",fontSize:13,margin:"0 0 10px"}}>Abre <code style={{color:"#FFD700"}}>src/App.js</code> y edita el array <code style={{color:"#FFD700"}}>PRIZES</code>. Los valores <code style={{color:"#FFD700"}}>p</code> deben sumar exactamente <strong style={{color:"#fff"}}>1.0</strong>:</p>
          <pre style={{background:"#0a0a0f",borderRadius:8,padding:12,color:"#00cc66",fontSize:11,overflowX:"auto",margin:0}}>{`{ label:"$500", amount:500, color:"#7c3aed", p:.05 }
//                                                ↑ probabilidad 5%`}</pre>
        </Sec>

        <Sec title="🔑 Cómo restablecer contraseña de un usuario">
          <p style={{color:"#666",fontSize:13,margin:0}}>Ve a <strong style={{color:"#fff"}}>Usuarios</strong> → busca al usuario → clic en <strong style={{color:"#FFD700"}}>✏️ Editar</strong> → sección <strong style={{color:"#0ea5e9"}}>Restablecer Contraseña</strong> → escribe la nueva contraseña → <strong style={{color:"#fff"}}>Cambiar</strong>. Luego dísela al usuario por WhatsApp.</p>
        </Sec>

        <Sec title="🎰 Cómo activar la ruleta para un usuario">
          <p style={{color:"#666",fontSize:13,margin:0}}>Ve a <strong style={{color:"#fff"}}>Usuarios</strong> → busca al usuario → clic en el botón <strong style={{color:"#00cc66"}}>🎰 Activar</strong>. Solo los usuarios con ruleta activa pueden girar. Puedes desactivarla en cualquier momento.</p>
        </Sec>

        <Sec title="🖼️ Cómo cambiar la foto de un carro">
          <p style={{color:"#666",fontSize:13,margin:"0 0 8px"}}>1. Busca la foto del carro en Google → clic derecho → "Copiar dirección de imagen"</p>
          <p style={{color:"#666",fontSize:13,margin:"0 0 8px"}}>2. En GitHub abre <code style={{color:"#FFD700"}}>src/App.js</code> → busca el carro → reemplaza la URL en el campo <code style={{color:"#FFD700"}}>img:</code></p>
          <p style={{color:"#444",fontSize:11,margin:0}}>💡 Tip: Usa imágenes de Wikipedia o Wikimedia para que no expiren.</p>
        </Sec>

      </div>
    </div>
  );
}

const Sec=({title,children})=>(<div style={{background:"#0f0f1a",border:"1px solid #141426",borderRadius:14,padding:20}}><h2 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>{title}</h2>{children}</div>);

const CSS=`*{box-sizing:border-box;}body{margin:0;}.inp{width:100%;padding:10px 12px;background:#0a0a0f;border:1px solid #1e1e2e;color:#fff;border-radius:9px;font-family:'Syne',sans-serif;font-size:12px;outline:none;display:block;transition:border-color .2s;}.inp:focus{border-color:#FFD700;}.inp::placeholder{color:#2a2a2a;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080810;}::-webkit-scrollbar-thumb{background:#141426;border-radius:2px;}`;
