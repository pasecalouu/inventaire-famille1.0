import { useState, useEffect, useRef } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth, provider } from "./firebase";

// ── Constantes ───────────────────────────────
const PIECES_DEFAULT = ["Cuisine","Garage","Salon","Salle de bain","Cave","Chambre"];
const CATEGORIES = [
  "🥩 Viandes & Poissons","🥦 Fruits & Légumes","🧀 Produits laitiers",
  "🍞 Féculents & Pains","🥫 Conserves & Bocaux","🧴 Hygiène","🧹 Entretien",
  "🍫 Épicerie sucrée","🧂 Épicerie salée","🧃 Boissons","❄️ Surgelés","💊 Pharmacie","Autre",
];
const CAT_EMOJI = {
  "🥩 Viandes & Poissons":"🥩","🥦 Fruits & Légumes":"🥦","🧀 Produits laitiers":"🧀",
  "🍞 Féculents & Pains":"🍞","🥫 Conserves & Bocaux":"🥫","🧴 Hygiène":"🧴",
  "🧹 Entretien":"🧹","🍫 Épicerie sucrée":"🍫","🧂 Épicerie salée":"🧂",
  "🧃 Boissons":"🧃","❄️ Surgelés":"❄️","💊 Pharmacie":"💊","Autre":"📦",
};
const UNITES = [
  {label:"Unité(s)",value:"unité"},{label:"Paquet(s)",value:"paquet"},
  {label:"Bouteille(s)",value:"bouteille"},{label:"Boîte(s)",value:"boîte"},
  {label:"Sachet(s)",value:"sachet"},{label:"Kg",value:"kg"},
  {label:"G",value:"g"},{label:"L",value:"l"},{label:"Cl",value:"cl"},
  {label:"Ml",value:"ml"},{label:"Tranche(s)",value:"tranche"},
  {label:"Portion(s)",value:"portion"},{label:"Demi(s)",value:"demi"},
  {label:"Quart(s)",value:"quart"},{label:"Tube(s)",value:"tube"},
  {label:"Rouleau(x)",value:"rouleau"},
];
const FRACTIONS = [
  {label:"1/2",value:0.5},{label:"1/4",value:0.25},
  {label:"3/4",value:0.75},{label:"1/3",value:0.333},{label:"2/3",value:0.667},
];
const QUANTITE_TYPES = [
  {label:"Nombre entier",value:"entier"},
  {label:"Avec fractions",value:"fraction"},
  {label:"Poids / Volume",value:"mesure"},
];
const CATS_RECETTES = [
  "Toutes","🍳 Entrées","🍝 Plats principaux","🥗 Salades","🍲 Soupes",
  "🍕 Pizzas & Tartes","🍰 Desserts","🥐 Petit-déjeuner","🥪 Sandwichs","⚡ Rapide (< 20 min)",
];
const JOURS_COURT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const JOURS_FULL  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MOIS_NOMS   = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const REPAS_TYPES = ["🌅 Petit-déj","☀️ Déjeuner","🌙 Dîner"];
const RECETTES_DEMO = [
  {id:"r1",nom:"Spaghetti Bolognaise",categorie:"🍝 Plats principaux",tempsPrep:15,tempsCuisson:30,description:"Le grand classique italien.",ingredients:[{nom:"Pâtes spaghetti",quantiteParPers:0.25,unite:"paquet"},{nom:"Viande hachée",quantiteParPers:0.15,unite:"kg"},{nom:"Tomates pelées",quantiteParPers:0.5,unite:"boîte"},{nom:"Oignon",quantiteParPers:0.5,unite:"unité"}],etapes:["Faire revenir l'oignon.","Dorer la viande.","Ajouter tomates, mijoter 20 min.","Cuire les pâtes al dente."]},
  {id:"r2",nom:"Omelette aux herbes",categorie:"🍳 Entrées",tempsPrep:5,tempsCuisson:5,description:"Simple et rapide.",ingredients:[{nom:"Œufs frais",quantiteParPers:2,unite:"unité"},{nom:"Beurre",quantiteParPers:0.02,unite:"kg"}],etapes:["Battre les œufs.","Faire fondre le beurre.","Cuire et replier."]},
  {id:"r3",nom:"Soupe de tomates",categorie:"🍲 Soupes",tempsPrep:10,tempsCuisson:25,description:"Réconfortante et savoureuse.",ingredients:[{nom:"Tomates pelées",quantiteParPers:1,unite:"boîte"},{nom:"Oignon",quantiteParPers:0.5,unite:"unité"}],etapes:["Revenir l'oignon.","Ajouter tomates et bouillon.","Mixer et servir."]},
];

// ── Hook responsive ──────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ── Utilitaires ──────────────────────────────
const getEmoji = c => CAT_EMOJI[c] || "📦";
const mkId = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
function formatQte(qte,unite,qteType){
  if(!qte&&qte!==0) return "—";
  const n=parseFloat(qte);
  if(qteType==="fraction"){
    const e=Math.floor(n),f=parseFloat((n%1).toFixed(3));
    if(f===0) return `${e} ${unite}`;
    if(f===0.5) return `${e?e+" ":""}½ ${unite}`;
    if(f===0.25) return `${e?e+" ":""}¼ ${unite}`;
    if(f===0.75) return `${e?e+" ":""}¾ ${unite}`;
    if(Math.abs(f-0.333)<0.01) return `${e?e+" ":""}⅓ ${unite}`;
    if(Math.abs(f-0.667)<0.01) return `${e?e+" ":""}⅔ ${unite}`;
  }
  return `${n} ${unite}`;
}
function getLundi(d){const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function dateKey(d){return d.toISOString().slice(0,10);}
function fmtDate(d){return `${d.getDate()} ${MOIS_NOMS[d.getMonth()]}`;}
function chkIng(ing,products,nbP){
  const need=ing.quantiteParPers*nbP;
  const found=products.find(p=>p.nom.toLowerCase().includes(ing.nom.toLowerCase())||ing.nom.toLowerCase().includes(p.nom.toLowerCase()));
  if(!found) return {status:"absent",found:null,need};
  return {status:found.quantite>=need?"ok":found.quantite>0?"insuffisant":"absent",found,need};
}
function isReal(r,products,nbP){return r.ingredients?.every(i=>chkIng(i,products,nbP).status==="ok");}
function calcBilan(menuSemaine,recettes,products,nbP){
  const b={};
  Object.values(menuSemaine).forEach(jour=>Object.values(jour).forEach(liste=>liste.forEach(rid=>{
    const r=recettes.find(x=>x.id===rid);if(!r)return;
    r.ingredients?.forEach(ing=>{const k=`${ing.nom.toLowerCase()}|${ing.unite}`;if(!b[k])b[k]={nom:ing.nom,unite:ing.unite,total:0};b[k].total+=ing.quantiteParPers*nbP;});
  })));
  return Object.values(b).map(x=>{
    const f=products.find(p=>p.nom.toLowerCase().includes(x.nom.toLowerCase())||x.nom.toLowerCase().includes(p.nom.toLowerCase()));
    const dispo=f?f.quantite:0;
    return {...x,dispo,status:!f?"absent":f.quantite>=x.total?"ok":f.quantite>0?"insuffisant":"absent"};
  }).sort((a,b)=>({absent:0,insuffisant:1,ok:2}[a.status]-{absent:0,insuffisant:1,ok:2}[b.status]));
}

// ── Styles ───────────────────────────────────
const F = "'DM Sans',sans-serif";
const iS = {width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 12px",fontSize:15,color:"#1e293b",fontFamily:F,outline:"none",background:"#f8fafc",boxSizing:"border-box"};
const btnP = {background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:F,width:"100%"};
const btnS = {background:"#f1f5f9",color:"#475569",border:"none",borderRadius:12,padding:"13px 0",fontWeight:600,fontSize:15,cursor:"pointer",fontFamily:F,width:"100%"};
const SS = {
  ok:{bg:"#d1fae5",br:"#6ee7b7",co:"#065f46",ic:"✅",dot:"#16a34a",label:"Disponible"},
  insuffisant:{bg:"#ffedd5",br:"#fdba74",co:"#9a3412",ic:"⚠️",dot:"#f97316",label:"Insuffisant"},
  absent:{bg:"#fee2e2",br:"#fca5a5",co:"#991b1b",ic:"❌",dot:"#ef4444",label:"À acheter"},
};

// ── Composants UI ────────────────────────────
function Badge({color,children}){
  const C={green:"#d1fae5;#065f46;#6ee7b7",orange:"#ffedd5;#9a3412;#fdba74",red:"#fee2e2;#991b1b;#fca5a5",blue:"#dbeafe;#1e40af;#93c5fd",gray:"#f3f4f6;#374151;#d1d5db",purple:"#ede9fe;#5b21b6;#c4b5fd"};
  const [bg,fg,br]=C[color].split(";");
  return <span style={{background:bg,color:fg,border:`1px solid ${br}`,borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-block",fontFamily:F}}>{children}</span>;
}

function Modal({open,onClose,title,children,wide}){
  if(!open) return null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0,backdropFilter:"blur(2px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)",padding:"0 0 32px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px 16px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,background:"#fff",zIndex:10}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:700,color:"#1e293b",fontFamily:F}}>{title}</h2>
          <button onClick={onClose} style={{border:"none",background:"#f1f5f9",borderRadius:999,width:36,height:36,cursor:"pointer",fontSize:20,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"16px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

function Lbl({label,children}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontWeight:600,fontSize:12,color:"#475569",marginBottom:6,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
      {children}
    </div>
  );
}

// ── Écran connexion ──────────────────────────
function LoginScreen({onLogin,loading}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:24,padding:36,maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.12)"}}>
        <div style={{fontSize:64,marginBottom:12}}>🏠</div>
        <h1 style={{margin:"0 0 8px",fontSize:26,fontWeight:800,color:"#1e293b",fontFamily:F}}>Mon Inventaire Famille</h1>
        <p style={{margin:"0 0 28px",color:"#64748b",fontSize:14,fontFamily:F,lineHeight:1.6}}>Gérez vos stocks, recettes et menus,<br/>synchronisés en temps réel.</p>
        <button onClick={onLogin} disabled={loading} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",background:"#fff",border:"2px solid #e2e8f0",borderRadius:14,padding:"14px 24px",cursor:"pointer",fontSize:16,fontWeight:700,color:"#1e293b",fontFamily:F,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
          <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          {loading?"Connexion...":"Continuer avec Google"}
        </button>
        <p style={{marginTop:16,fontSize:12,color:"#94a3b8",fontFamily:F}}>Toute la famille se connecte avec Google.</p>
      </div>
    </div>
  );
}

// ── NavBar PC (en haut) ──────────────────────
function NavBarPC({page,setPage,user,onLogout}){
  const tabs=[{id:"inventaire",label:"Inventaire",icon:"📦"},{id:"recettes",label:"Recettes",icon:"👨‍🍳"},{id:"menu",label:"Menu",icon:"📅"},{id:"courses",label:"Courses",icon:"🛒"}];
  return(
    <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setPage(t.id)} style={{border:"none",background:"none",padding:"16px 22px",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:F,color:page===t.id?"#15803d":"#64748b",borderBottom:page===t.id?"3px solid #15803d":"3px solid transparent",display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:16}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:999,padding:"5px 14px 5px 6px"}}>
          <div style={{width:28,height:28,borderRadius:999,background:"#15803d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700,overflow:"hidden"}}>
            {user.photoURL?<img src={user.photoURL} alt="" style={{width:28,height:28}}/>:(user.displayName?.[0]||"?")}
          </div>
          <span style={{fontSize:14,fontWeight:600,color:"#334155",fontFamily:F}}>{user.displayName?.split(" ")[0]||"Utilisateur"}</span>
        </div>
        <button onClick={onLogout} style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:10,padding:"7px 14px",cursor:"pointer",fontSize:13,color:"#64748b",fontFamily:F,fontWeight:600}}>Déconnexion</button>
      </div>
    </div>
  );
}

// ── NavBar Mobile (en bas) ───────────────────
function NavBarMobile({page,setPage}){
  const tabs=[{id:"inventaire",label:"Inventaire",icon:"📦"},{id:"recettes",label:"Recettes",icon:"👨‍🍳"},{id:"menu",label:"Menu",icon:"📅"},{id:"courses",label:"Courses",icon:"🛒"}];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:100,boxShadow:"0 -4px 16px rgba(0,0,0,0.08)",paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setPage(t.id)} style={{flex:1,border:"none",background:"none",padding:"10px 0 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span style={{fontSize:22}}>{t.icon}</span>
          <span style={{fontSize:11,fontWeight:700,fontFamily:F,color:page===t.id?"#15803d":"#94a3b8"}}>{t.label}</span>
          {page===t.id&&<div style={{width:20,height:3,borderRadius:999,background:"#15803d",marginTop:1}}/>}
        </button>
      ))}
    </div>
  );
}

// ── Formulaire produit ───────────────────────
function ProductForm({initial,pieces,onSave,onCancel}){
  const [f,setF]=useState(initial||{nom:"",categorie:CATEGORIES[0],quantite:1,qteType:"entier",unite:"unité",fracPart:0,description:"",piece:pieces[0]||"",seuilAlerte:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const qte=()=>f.qteType==="fraction"?parseFloat(f.quantite||0)+parseFloat(f.fracPart||0):parseFloat(f.quantite||0);
  const save=()=>{if(!f.nom.trim())return alert("Nom obligatoire.");onSave({...f,quantite:qte()});};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:14,background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
        <div style={{fontSize:44}}>{getEmoji(f.categorie)}</div>
        <div><div style={{fontWeight:700,fontSize:16,color:"#1e293b",fontFamily:F}}>{f.nom||"Nom du produit"}</div><div style={{fontSize:12,color:"#86efac",fontFamily:F,marginTop:2}}>Icône selon la catégorie</div></div>
      </div>
      <Lbl label="Nom *"><input style={iS} value={f.nom} onChange={e=>s("nom",e.target.value)} placeholder="Ex : Pâtes spaghetti..."/></Lbl>
      <Lbl label="Catégorie"><select style={iS} value={f.categorie} onChange={e=>s("categorie",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Lbl label="Type"><select style={iS} value={f.qteType} onChange={e=>s("qteType",e.target.value)}>{QUANTITE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></Lbl>
        <Lbl label="Unité"><select style={iS} value={f.unite} onChange={e=>s("unite",e.target.value)}>{UNITES.map(u=><option key={u.value} value={u.value}>{u.label}</option>)}</select></Lbl>
      </div>
      <div style={{display:"grid",gridTemplateColumns:f.qteType==="fraction"?"1fr 1fr":"1fr",gap:12}}>
        <Lbl label="Quantité"><input style={iS} type="number" min="0" value={f.quantite} onChange={e=>s("quantite",e.target.value)}/></Lbl>
        {f.qteType==="fraction"&&<Lbl label="Fraction"><select style={iS} value={f.fracPart} onChange={e=>s("fracPart",e.target.value)}><option value={0}>Aucune</option>{FRACTIONS.map(x=><option key={x.label} value={x.value}>{x.label}</option>)}</select></Lbl>}
      </div>
      <Lbl label="Seuil d'alerte"><input style={iS} type="number" min="0" value={f.seuilAlerte} onChange={e=>s("seuilAlerte",e.target.value)} placeholder={`Alerte en-dessous de X ${f.unite}`}/></Lbl>
      <Lbl label="Pièce"><select style={iS} value={f.piece} onChange={e=>s("piece",e.target.value)}>{pieces.map(p=><option key={p}>{p}</option>)}</select></Lbl>
      <Lbl label="Description / Emplacement"><textarea style={{...iS,minHeight:80,resize:"vertical"}} value={f.description} onChange={e=>s("description",e.target.value)} placeholder="Ex : Placard du haut à gauche..."/></Lbl>
      <div style={{display:"flex",gap:10,marginTop:8}}><button onClick={save} style={btnP}>✅ Enregistrer</button><button onClick={onCancel} style={btnS}>Annuler</button></div>
    </div>
  );
}

// ── Modal ajustement ─────────────────────────
function AdjustModal({product,onClose,onSave}){
  const [mode,setMode]=useState("add");
  const [qE,setQE]=useState(1);
  const [frac,setFrac]=useState(0);
  const delta=parseFloat(qE||0)+parseFloat(frac||0);
  const nq=mode==="add"?product.quantite+delta:Math.max(0,product.quantite-delta);
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20,background:"#f1f5f9",borderRadius:14,padding:4}}>
        {[{v:"add",l:"➕ Ajouter"},{v:"remove",l:"➖ Retirer"}].map(m=>(
          <button key={m.v} onClick={()=>setMode(m.v)} style={{flex:1,border:"none",borderRadius:10,padding:"12px 0",cursor:"pointer",fontWeight:700,fontSize:15,fontFamily:F,background:mode===m.v?(m.v==="add"?"#16a34a":"#dc2626"):"transparent",color:mode===m.v?"#fff":"#64748b"}}>{m.l}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:product.qteType==="fraction"?"1fr 1fr":"1fr",gap:12}}>
        <Lbl label={`Quantité (${product.unite})`}><input style={iS} type="number" min="0" value={qE} onChange={e=>setQE(e.target.value)}/></Lbl>
        {product.qteType==="fraction"&&<Lbl label="Fraction"><select style={iS} value={frac} onChange={e=>setFrac(e.target.value)}><option value={0}>Aucune</option>{FRACTIONS.map(x=><option key={x.label} value={x.value}>{x.label}</option>)}</select></Lbl>}
      </div>
      <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"14px 16px",marginBottom:20,fontSize:15,color:"#334155",fontFamily:F,textAlign:"center"}}>
        <span style={{opacity:0.7}}>{formatQte(product.quantite,product.unite,product.qteType)}</span>
        <span style={{margin:"0 12px",fontSize:20}}>→</span>
        <strong style={{color:mode==="add"?"#16a34a":"#dc2626",fontSize:18}}>{formatQte(nq,product.unite,product.qteType)}</strong>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>onSave(nq)} style={{...btnP,background:mode==="add"?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#dc2626,#b91c1c)"}}>Confirmer</button>
        <button onClick={onClose} style={btnS}>Annuler</button>
      </div>
    </div>
  );
}

// ── Carte produit ────────────────────────────
function ProductCard({product,onAdjust,onEdit,onDelete,mobile}){
  const al=product.seuilAlerte&&product.quantite<=parseFloat(product.seuilAlerte);
  const em=product.quantite<=0;
  if(mobile){
    return(
      <div style={{background:"#fff",borderRadius:16,border:em?"2px solid #fca5a5":al?"2px solid #fdba74":"1.5px solid #e2e8f0",padding:"14px 16px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{width:52,height:52,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{getEmoji(product.categorie)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F,marginBottom:2}}>{product.nom}</div>
          <div style={{fontSize:12,color:"#64748b",fontFamily:F}}>📍 {product.piece}</div>
          <div style={{fontWeight:800,fontSize:16,color:em?"#ef4444":al?"#f97316":"#16a34a",fontFamily:F,marginTop:3}}>{formatQte(product.quantite,product.unite,product.qteType)}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
          <button onClick={()=>onAdjust(product)} style={{border:"none",background:"#ecfdf5",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:16}}>⚡</button>
          <button onClick={()=>onEdit(product)} style={{border:"none",background:"#eff6ff",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:16}}>✏️</button>
          <button onClick={()=>onDelete(product.id)} style={{border:"none",background:"#fff1f2",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:16}}>🗑️</button>
        </div>
      </div>
    );
  }
  return(
    <div style={{background:"#fff",borderRadius:16,border:em?"2px solid #fca5a5":al?"2px solid #fdba74":"1.5px solid #e2e8f0",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 2px 12px rgba(0,0,0,0.05)",position:"relative",transition:"transform 0.15s,box-shadow 0.15s"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.1)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.05)";}}>
      {(em||al)&&<div style={{position:"absolute",top:10,right:10,background:em?"#fee2e2":"#ffedd5",borderRadius:999,fontSize:16,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>{em?"🚫":"⚠️"}</div>}
      <div style={{width:"100%",height:90,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>{getEmoji(product.categorie)}</div>
      <div style={{padding:"12px 14px",flex:1,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F}}>{product.nom}</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <Badge color="gray">{product.categorie?.replace(/^[^\s]+ /,"")}</Badge>
          <Badge color="blue">📍 {product.piece}</Badge>
        </div>
        {product.description&&<div style={{fontSize:12,color:"#94a3b8",fontFamily:F,lineHeight:1.4}}>{product.description.length>55?product.description.slice(0,55)+"…":product.description}</div>}
        <div style={{marginTop:"auto",paddingTop:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:800,fontSize:16,color:em?"#ef4444":al?"#f97316":"#16a34a",fontFamily:F}}>{formatQte(product.quantite,product.unite,product.qteType)}</span>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>onAdjust(product)} style={{border:"none",background:"#ecfdf5",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:14}}>⚡</button>
            <button onClick={()=>onEdit(product)} style={{border:"none",background:"#eff6ff",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:14}}>✏️</button>
            <button onClick={()=>onDelete(product.id)} style={{border:"none",background:"#fff1f2",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:14}}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page Inventaire ──────────────────────────
function PageInventaire({products,pieces,setPieces,isMobile}){
  const [showAdd,setShowAdd]=useState(false);
  const [editP,setEditP]=useState(null);
  const [adjP,setAdjP]=useState(null);
  const [showPieces,setShowPieces]=useState(false);
  const [newPiece,setNewPiece]=useState("");
  const [search,setSearch]=useState("");
  const [showFilters,setShowFilters]=useState(false);
  const [fCat,setFCat]=useState("Toutes");
  const [fPiece,setFPiece]=useState("Toutes");
  const [fAlert,setFAlert]=useState(false);
  const [sort,setSort]=useState("nom");

  const saveP=async d=>{const id=d.id||mkId();const {fracPart,...r}=d;await setDoc(doc(db,"produits",id),{...r,id});setShowAdd(false);setEditP(null);};
  const delP=async id=>{if(window.confirm("Supprimer ?"))await deleteDoc(doc(db,"produits",id));};
  const adjQ=async nq=>{await setDoc(doc(db,"produits",adjP.id),{...adjP,quantite:nq});setAdjP(null);};
  const savePieces=async p=>{setPieces(p);await setDoc(doc(db,"config","pieces"),{liste:p});};

  const alerts=products.filter(p=>p.seuilAlerte&&p.quantite<=parseFloat(p.seuilAlerte));
  const empty=products.filter(p=>p.quantite<=0);
  const filtered=products.filter(p=>{
    if(search&&!p.nom?.toLowerCase().includes(search.toLowerCase()))return false;
    if(fCat!=="Toutes"&&p.categorie!==fCat)return false;
    if(fPiece!=="Toutes"&&p.piece!==fPiece)return false;
    if(fAlert&&!(p.seuilAlerte&&p.quantite<=parseFloat(p.seuilAlerte)))return false;
    return true;
  }).sort((a,b)=>sort==="nom"?(a.nom||"").localeCompare(b.nom||""):sort==="qte"?b.quantite-a.quantite:(a.categorie||"").localeCompare(b.categorie||""));

  return(
    <div style={{paddingBottom:isMobile?90:0}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#15803d,#166534)",padding:isMobile?"20px 16px 16px":"24px 28px 20px",color:"#fff"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:isMobile?26:30}}>📦</span>
                <h1 style={{margin:0,fontSize:isMobile?22:26,fontWeight:800,fontFamily:F}}>Mon Inventaire</h1>
              </div>
              <p style={{margin:"4px 0 0",opacity:0.8,fontSize:13,fontFamily:F}}>{products.length} produit{products.length>1?"s":""} · sync 🔄</p>
            </div>
            <div style={{display:"flex",gap:8}}>
              {!isMobile&&<button onClick={()=>setShowPieces(true)} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:12,padding:"10px 16px",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:F}}>🏡 Pièces</button>}
              <button onClick={()=>setShowAdd(true)} style={{background:"#fff",color:"#15803d",border:"none",borderRadius:12,padding:isMobile?"10px 16px":"10px 20px",cursor:"pointer",fontWeight:800,fontSize:isMobile?14:15,fontFamily:F,boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>+ Ajouter</button>
            </div>
          </div>
          {/* Stats */}
          <div style={{display:"flex",gap:10}}>
            {[{l:"Total",v:products.length,e:"📦",c:"rgba(255,255,255,0.2)"},{l:"Alertes",v:alerts.length,e:"⚠️",c:alerts.length?"rgba(251,146,60,0.35)":"rgba(255,255,255,0.2)"},{l:"Épuisés",v:empty.length,e:"🚫",c:empty.length?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.2)"}].map(s=>(
              <div key={s.l} style={{background:s.c,borderRadius:12,padding:isMobile?"8px 14px":"10px 18px",border:"1px solid rgba(255,255,255,0.2)",flex:isMobile?1:undefined,textAlign:isMobile?"center":"left"}}>
                <div style={{fontSize:isMobile?16:18}}>{s.e}</div>
                <div style={{fontWeight:800,fontSize:isMobile?18:22,fontFamily:F}}>{s.v}</div>
                <div style={{fontSize:11,opacity:0.8,fontFamily:F}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barre recherche + filtres */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:isMobile?"12px 16px":"14px 28px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:isMobile&&showFilters?10:0}}>
            <input style={{...iS,flex:1,fontSize:14}} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {isMobile?(
              <button onClick={()=>setShowFilters(v=>!v)} style={{border:"1.5px solid #e2e8f0",background:showFilters?"#f0fdf4":"#fff",borderRadius:10,padding:"11px 14px",cursor:"pointer",fontSize:14,fontWeight:700,color:showFilters?"#15803d":"#64748b",fontFamily:F,whiteSpace:"nowrap"}}>
                🔧 {fCat!=="Toutes"||fPiece!=="Toutes"||fAlert?"●":"Filtres"}
              </button>
            ):(
              <>
                <select style={{...iS,width:170}} value={fCat} onChange={e=>setFCat(e.target.value)}><option value="Toutes">Toutes catégories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                <select style={{...iS,width:150}} value={fPiece} onChange={e=>setFPiece(e.target.value)}><option value="Toutes">Toutes pièces</option>{pieces.map(p=><option key={p}>{p}</option>)}</select>
                <select style={{...iS,width:140}} value={sort} onChange={e=>setSort(e.target.value)}><option value="nom">A → Z</option><option value="qte">Quantité</option><option value="cat">Catégorie</option></select>
                <button onClick={()=>setFAlert(v=>!v)} style={{border:"1.5px solid",borderColor:fAlert?"#f97316":"#e2e8f0",background:fAlert?"#ffedd5":"#f8fafc",borderRadius:10,padding:"11px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:fAlert?"#c2410c":"#64748b",fontFamily:F,whiteSpace:"nowrap"}}>⚠️ Alertes</button>
                <button onClick={()=>setShowPieces(true)} style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:10,padding:"11px 14px",cursor:"pointer",fontSize:13,color:"#64748b",fontFamily:F,fontWeight:600,whiteSpace:"nowrap"}}>🏡 Pièces</button>
              </>
            )}
          </div>
          {/* Filtres mobile dépliables */}
          {isMobile&&showFilters&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
              <select style={iS} value={fCat} onChange={e=>setFCat(e.target.value)}><option value="Toutes">Toutes catégories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
              <select style={iS} value={fPiece} onChange={e=>setFPiece(e.target.value)}><option value="Toutes">Toutes pièces</option>{pieces.map(p=><option key={p}>{p}</option>)}</select>
              <div style={{display:"flex",gap:8}}>
                <select style={{...iS,flex:1}} value={sort} onChange={e=>setSort(e.target.value)}><option value="nom">A → Z</option><option value="qte">Quantité</option><option value="cat">Catégorie</option></select>
                <button onClick={()=>setFAlert(v=>!v)} style={{border:"1.5px solid",borderColor:fAlert?"#f97316":"#e2e8f0",background:fAlert?"#ffedd5":"#f8fafc",borderRadius:10,padding:"11px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:fAlert?"#c2410c":"#64748b",fontFamily:F,whiteSpace:"nowrap"}}>⚠️</button>
              </div>
              <button onClick={()=>setShowPieces(true)} style={{...btnS,padding:"11px 0"}}>🏡 Gérer les pièces</button>
            </div>
          )}
        </div>
      </div>

      {/* Liste produits */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"16px":"24px 28px"}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}><div style={{fontSize:48,marginBottom:12}}>📭</div><div style={{fontSize:18,fontWeight:600}}>Aucun produit</div></div>
        ):isMobile?(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(p=><ProductCard key={p.id} product={p} onAdjust={setAdjP} onEdit={setEditP} onDelete={delP} mobile/>)}
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
            {filtered.map(p=><ProductCard key={p.id} product={p} onAdjust={setAdjP} onEdit={setEditP} onDelete={delP}/>)}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="➕ Nouveau produit"><ProductForm pieces={pieces} onSave={saveP} onCancel={()=>setShowAdd(false)}/></Modal>
      <Modal open={!!editP} onClose={()=>setEditP(null)} title="✏️ Modifier">{editP&&<ProductForm initial={editP} pieces={pieces} onSave={saveP} onCancel={()=>setEditP(null)}/>}</Modal>
      <Modal open={!!adjP} onClose={()=>setAdjP(null)} title={`⚡ ${adjP?.nom||""}`}>{adjP&&<AdjustModal product={adjP} onClose={()=>setAdjP(null)} onSave={adjQ}/>}</Modal>
      <Modal open={showPieces} onClose={()=>setShowPieces(false)} title="🏡 Gérer les pièces">
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {pieces.map(p=>(
            <div key={p} style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",border:"1.5px solid #e2e8f0",borderRadius:999,padding:"7px 16px",fontSize:14,fontWeight:600,color:"#334155",fontFamily:F}}>
              {p}{!PIECES_DEFAULT.includes(p)&&<button onClick={()=>{if(products.some(x=>x.piece===p))return alert("Pièce utilisée.");savePieces(pieces.filter(x=>x!==p));}} style={{border:"none",background:"none",cursor:"pointer",color:"#ef4444",fontSize:18,padding:0,marginLeft:2}}>×</button>}
            </div>
          ))}
        </div>
        <Lbl label="Nouvelle pièce">
          <div style={{display:"flex",gap:8}}>
            <input style={{...iS,flex:1}} value={newPiece} onChange={e=>setNewPiece(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newPiece.trim()&&!pieces.includes(newPiece.trim())){savePieces([...pieces,newPiece.trim()]);setNewPiece("");}}} placeholder="Ex : Sous-sol..."/>
            <button onClick={()=>{if(newPiece.trim()&&!pieces.includes(newPiece.trim())){savePieces([...pieces,newPiece.trim()]);setNewPiece("");}}} style={{background:"#15803d",color:"#fff",border:"none",borderRadius:10,padding:"0 20px",cursor:"pointer",fontWeight:700,fontSize:16,fontFamily:F}}>+</button>
          </div>
        </Lbl>
        <button onClick={()=>setShowPieces(false)} style={btnS}>Fermer</button>
      </Modal>
    </div>
  );
}

// ── Formulaire recette ───────────────────────
function RecetteForm({initial,onSave,onCancel}){
  const [f,setF]=useState(initial||{nom:"",categorie:"🍝 Plats principaux",tempsPrep:15,tempsCuisson:30,description:"",ingredients:[],etapes:[""]});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const addI=()=>s("ingredients",[...f.ingredients,{nom:"",quantiteParPers:1,unite:"unité"}]);
  const updI=(i,k,v)=>s("ingredients",f.ingredients.map((x,j)=>j===i?{...x,[k]:v}:x));
  const delI=i=>s("ingredients",f.ingredients.filter((_,j)=>j!==i));
  const addE=()=>s("etapes",[...f.etapes,""]);
  const updE=(i,v)=>s("etapes",f.etapes.map((x,j)=>j===i?v:x));
  const delE=i=>s("etapes",f.etapes.filter((_,j)=>j!==i));
  const save=()=>{if(!f.nom.trim())return alert("Nom obligatoire.");if(!f.ingredients.length)return alert("Ajoutez un ingrédient.");onSave({...f,id:initial?.id||mkId()});};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:14,background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:40}}>{f.categorie?.split(" ")[0]||"🍽️"}</div>
        <div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F}}>{f.nom||"Nom de la recette"}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Lbl label="Nom *"><input style={iS} value={f.nom} onChange={e=>s("nom",e.target.value)} placeholder="Ex : Quiche Lorraine"/></Lbl>
        <Lbl label="Catégorie"><select style={iS} value={f.categorie} onChange={e=>s("categorie",e.target.value)}>{CATS_RECETTES.filter(c=>c!=="Toutes").map(c=><option key={c}>{c}</option>)}</select></Lbl>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Lbl label="⏱ Prépa (min)"><input style={iS} type="number" min="0" value={f.tempsPrep} onChange={e=>s("tempsPrep",parseInt(e.target.value)||0)}/></Lbl>
        <Lbl label="🔥 Cuisson (min)"><input style={iS} type="number" min="0" value={f.tempsCuisson} onChange={e=>s("tempsCuisson",parseInt(e.target.value)||0)}/></Lbl>
      </div>
      <Lbl label="Description"><textarea style={{...iS,minHeight:60,resize:"vertical"}} value={f.description} onChange={e=>s("description",e.target.value)} placeholder="Décrivez la recette..."/></Lbl>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={{fontWeight:600,fontSize:12,color:"#475569",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:F}}>Ingrédients / personne</label>
          <button onClick={addI} style={{background:"#ecfdf5",color:"#16a34a",border:"1px solid #6ee7b7",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:F}}>+ Ajouter</button>
        </div>
        {!f.ingredients.length&&<div style={{textAlign:"center",padding:16,background:"#f8fafc",borderRadius:10,color:"#94a3b8",fontSize:13}}>Ajoutez des ingrédients</div>}
        {f.ingredients.map((ing,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
            <input style={iS} placeholder="Nom" value={ing.nom} onChange={e=>updI(i,"nom",e.target.value)}/>
            <input style={iS} type="number" min="0" step="0.1" value={ing.quantiteParPers} onChange={e=>updI(i,"quantiteParPers",parseFloat(e.target.value)||0)}/>
            <select style={iS} value={ing.unite} onChange={e=>updI(i,"unite",e.target.value)}>{UNITES.map(u=><option key={u.value} value={u.value}>{u.label}</option>)}</select>
            <button onClick={()=>delI(i)} style={{border:"none",background:"#fff1f2",borderRadius:8,padding:"10px 12px",cursor:"pointer",fontSize:14,color:"#e11d48"}}>🗑️</button>
          </div>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={{fontWeight:600,fontSize:12,color:"#475569",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:F}}>Étapes</label>
          <button onClick={addE} style={{background:"#eff6ff",color:"#2563eb",border:"1px solid #93c5fd",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:F}}>+ Étape</button>
        </div>
        {f.etapes.map((e,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
            <div style={{minWidth:30,height:30,background:"#15803d",borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,marginTop:8}}>{i+1}</div>
            <textarea style={{...iS,flex:1,minHeight:60,resize:"vertical"}} value={e} onChange={ev=>updE(i,ev.target.value)} placeholder={`Étape ${i+1}...`}/>
            <button onClick={()=>delE(i)} style={{border:"none",background:"#fff1f2",borderRadius:8,padding:"10px 12px",cursor:"pointer",fontSize:14,color:"#e11d48",marginTop:4}}>🗑️</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10}}><button onClick={save} style={btnP}>✅ Enregistrer</button><button onClick={onCancel} style={btnS}>Annuler</button></div>
    </div>
  );
}

// ── Page Recettes ────────────────────────────
function PageRecettes({products,recettes,isMobile}){
  const [fCat,setFCat]=useState("Toutes");
  const [search,setSearch]=useState("");
  const [onlyReal,setOnlyReal]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [editR,setEditR]=useState(null);
  const [detailR,setDetailR]=useState(null);
  const [nbPD,setNbPD]=useState(4);
  const NB=4;
  const saveR=async d=>{await setDoc(doc(db,"recettes",d.id),d);setShowAdd(false);setEditR(null);};
  const delR=async id=>{await deleteDoc(doc(db,"recettes",id));setDetailR(null);};
  const filtered=recettes.filter(r=>{
    if(search&&!r.nom?.toLowerCase().includes(search.toLowerCase()))return false;
    if(fCat!=="Toutes"&&r.categorie!==fCat)return false;
    if(onlyReal&&!isReal(r,products,NB))return false;
    return true;
  });
  return(
    <div style={{paddingBottom:isMobile?90:0}}>
      <div style={{padding:isMobile?"16px":"24px 28px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{margin:0,fontSize:isMobile?20:24,fontWeight:800,color:"#1e293b",fontFamily:F}}>👨‍🍳 Mes Recettes</h2>
            <p style={{margin:"4px 0 0",color:"#64748b",fontSize:13,fontFamily:F}}>{recettes.length} recette{recettes.length>1?"s":""}</p>
          </div>
          <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#15803d,#166534)",color:"#fff",border:"none",borderRadius:12,padding:"12px 20px",cursor:"pointer",fontWeight:800,fontSize:15,fontFamily:F,boxShadow:"0 4px 12px rgba(21,128,61,0.3)"}}>+ Nouvelle</button>
        </div>
        {/* Filtres */}
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:10,marginBottom:20}}>
          <input style={{...iS,flex:1}} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{...iS,width:isMobile?"100%":"200px"}} value={fCat} onChange={e=>setFCat(e.target.value)}>{CATS_RECETTES.map(c=><option key={c}>{c}</option>)}</select>
          <button onClick={()=>setOnlyReal(v=>!v)} style={{border:"1.5px solid",borderColor:onlyReal?"#16a34a":"#e2e8f0",background:onlyReal?"#d1fae5":"#f8fafc",borderRadius:10,padding:"11px 14px",cursor:"pointer",fontSize:13,fontWeight:700,color:onlyReal?"#15803d":"#64748b",fontFamily:F,whiteSpace:"nowrap"}}>✅ Réalisable maintenant</button>
        </div>
        {/* Grille */}
        {!filtered.length?(
          <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}><div style={{fontSize:48,marginBottom:12}}>🍽️</div><div style={{fontSize:18,fontWeight:600}}>{onlyReal?"Aucune recette réalisable":"Aucune recette"}</div></div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:isMobile?12:16}}>
            {filtered.map(r=>{
              const real=isReal(r,products,NB),nbOk=r.ingredients?.filter(i=>chkIng(i,products,NB).status==="ok").length||0,total=r.ingredients?.length||0,pct=total?Math.round(nbOk/total*100):0;
              return(
                <div key={r.id} onClick={()=>{setDetailR(r);setNbPD(4);}} style={{background:"#fff",borderRadius:16,border:"1.5px solid #e2e8f0",overflow:"hidden",cursor:"pointer",outline:real?"2px solid #16a34a":"none",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:isMobile?"flex":"block",alignItems:isMobile?"center":"unset",gap:isMobile?14:"unset"}}>
                  <div style={{width:isMobile?64:"100%",height:isMobile?64:80,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?32:44,flexShrink:0,borderRadius:isMobile?12:0}}>{r.categorie?.split(" ")[0]||"🍽️"}</div>
                  <div style={{padding:isMobile?"12px 12px 12px 0":"12px 14px",flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:4,fontFamily:F}}>{r.nom}{real&&" ✅"}</div>
                    {!isMobile&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><Badge color="purple">{r.categorie?.replace(/^[^\s]+ /,"")}</Badge><Badge color="blue">⏱ {(r.tempsPrep||0)+(r.tempsCuisson||0)} min</Badge></div>}
                    {isMobile&&<div style={{fontSize:12,color:"#64748b",fontFamily:F,marginBottom:4}}>⏱ {(r.tempsPrep||0)+(r.tempsCuisson||0)} min</div>}
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#64748b",fontFamily:F}}>{nbOk}/{total} ingrédients</span><span style={{fontSize:11,fontWeight:700,color:pct===100?"#16a34a":pct>50?"#f97316":"#ef4444",fontFamily:F}}>{pct}%</span></div>
                    <div style={{height:4,background:"#f1f5f9",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",borderRadius:999,width:`${pct}%`,background:pct===100?"#16a34a":pct>50?"#f97316":"#ef4444"}}/></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="➕ Nouvelle recette"><RecetteForm onSave={saveR} onCancel={()=>setShowAdd(false)}/></Modal>
      <Modal open={!!editR} onClose={()=>setEditR(null)} title="✏️ Modifier">{editR&&<RecetteForm initial={editR} onSave={saveR} onCancel={()=>setEditR(null)}/>}</Modal>
      <Modal open={!!detailR} onClose={()=>setDetailR(null)} title={detailR?.nom||""}>
        {detailR&&(
          <div>
            <div style={{height:80,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:52,borderRadius:12,marginBottom:16}}>{detailR.categorie?.split(" ")[0]||"🍽️"}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}><Badge color="purple">{detailR.categorie}</Badge><Badge color="blue">⏱ {detailR.tempsPrep} min prépa</Badge><Badge color="orange">🔥 {detailR.tempsCuisson} min cuisson</Badge></div>
            {detailR.description&&<p style={{color:"#475569",fontSize:14,fontFamily:F,lineHeight:1.6,marginBottom:16}}>{detailR.description}</p>}
            <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontWeight:600,fontSize:14,color:"#334155",fontFamily:F}}>👥 Personnes :</span>
              <button onClick={()=>setNbPD(n=>Math.max(1,n-1))} style={{border:"none",background:"#e2e8f0",borderRadius:999,width:36,height:36,cursor:"pointer",fontSize:18,fontWeight:700}}>−</button>
              <span style={{fontWeight:800,fontSize:22,color:"#15803d",minWidth:28,textAlign:"center",fontFamily:F}}>{nbPD}</span>
              <button onClick={()=>setNbPD(n=>n+1)} style={{border:"none",background:"#e2e8f0",borderRadius:999,width:36,height:36,cursor:"pointer",fontSize:18,fontWeight:700}}>+</button>
            </div>
            <h3 style={{margin:"0 0 10px",fontSize:16,fontWeight:700,color:"#1e293b",fontFamily:F}}>🛒 Ingrédients</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {detailR.ingredients?.map((ing,i)=>{const s=chkIng(ing,products,nbPD),c=SS[s.status],qt=(ing.quantiteParPers*nbPD).toFixed(2).replace(/\.?0+$/,"");return(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:c.bg,border:`1.5px solid ${c.br}`,borderRadius:12,padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>{c.ic}</span><span style={{fontWeight:600,fontSize:14,color:"#1e293b",fontFamily:F}}>{ing.nom}</span></div>
                  <span style={{fontWeight:700,fontSize:14,color:c.co,fontFamily:F}}>{qt} {ing.unite}</span>
                </div>
              );})}
            </div>
            {detailR.etapes?.length>0&&(<><h3 style={{margin:"0 0 10px",fontSize:16,fontWeight:700,color:"#1e293b",fontFamily:F}}>👨‍🍳 Préparation</h3><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>{detailR.etapes.map((e,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{minWidth:30,height:30,background:"#15803d",borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,marginTop:1}}>{i+1}</div><p style={{margin:0,fontSize:14,color:"#334155",fontFamily:F,lineHeight:1.6}}>{e}</p></div>)}</div></>)}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setDetailR(null);setEditR(detailR);}} style={{...btnS,flex:1}}>✏️ Modifier</button>
              <button onClick={()=>{if(window.confirm("Supprimer ?"))delR(detailR.id);}} style={{flex:1,background:"#fff1f2",color:"#e11d48",border:"1px solid #fca5a5",borderRadius:12,padding:"13px 0",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:F}}>🗑️ Supprimer</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Page Menu ────────────────────────────────
function PageMenu({products,recettes,menuSemaine,isMobile}){
  const today=new Date();
  const [lundi,setLundi]=useState(getLundi(today));
  const [jourActif,setJourActif]=useState(0); // mobile: index du jour affiché
  const [nbP,setNbP]=useState(4);
  const [picker,setPicker]=useState(null);
  const [searchR,setSearchR]=useState("");

  const jours7=Array.from({length:7},(_,i)=>addDays(lundi,i));
  const isToday=d=>dateKey(d)===dateKey(today);

  const addPlat=async(dk,rt,rid)=>{const j=menuSemaine[dk]||{},r=j[rt]||[];if(r.includes(rid))return;await setDoc(doc(db,"menu",dk),{...j,[rt]:[...r,rid]});setPicker(null);};
  const remPlat=async(dk,rt,rid)=>{const j={...(menuSemaine[dk]||{})};j[rt]=(j[rt]||[]).filter(id=>id!==rid);if(!j[rt].length)delete j[rt];if(!Object.keys(j).length)await deleteDoc(doc(db,"menu",dk));else await setDoc(doc(db,"menu",dk),j);};
  const vider=async dk=>deleteDoc(doc(db,"menu",dk));

  const bilanW=Object.fromEntries(jours7.map(d=>[dateKey(d),menuSemaine[dateKey(d)]||{}]));
  const bilan=calcBilan(bilanW,recettes,products,nbP);
  const totalP=jours7.reduce((a,d)=>a+Object.values(menuSemaine[dateKey(d)]||{}).reduce((x,r)=>x+r.length,0),0);
  const recsF=recettes.filter(r=>!searchR||r.nom?.toLowerCase().includes(searchR.toLowerCase()));

  // Jour actif sur mobile
  const dateActif=jours7[jourActif];
  const dkActif=dateKey(dateActif);
  const jourMenuActif=menuSemaine[dkActif]||{};

  return(
    <div style={{paddingBottom:isMobile?90:0}}>
      {/* Header bleu */}
      <div style={{background:"linear-gradient(135deg,#1e40af,#1d4ed8)",padding:isMobile?"16px":"22px 28px",color:"#fff",marginBottom:isMobile?0:20}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:isMobile?24:28}}>📅</span><h2 style={{margin:0,fontSize:isMobile?20:24,fontWeight:800,fontFamily:F}}>Menu semaine</h2></div>
              <p style={{margin:"4px 0 0",opacity:0.8,fontSize:13,fontFamily:F}}>{fmtDate(lundi)} – {fmtDate(addDays(lundi,6))} · {totalP} plat{totalP>1?"s":""}</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"7px 12px",border:"1px solid rgba(255,255,255,0.25)"}}>
                <span style={{fontSize:12}}>👥</span>
                <button onClick={()=>setNbP(n=>Math.max(1,n-1))} style={{border:"none",background:"rgba(255,255,255,0.2)",borderRadius:999,width:28,height:28,cursor:"pointer",fontSize:16,color:"#fff",fontWeight:700}}>−</button>
                <span style={{fontWeight:800,fontSize:16,minWidth:18,textAlign:"center",fontFamily:F}}>{nbP}</span>
                <button onClick={()=>setNbP(n=>n+1)} style={{border:"none",background:"rgba(255,255,255,0.2)",borderRadius:999,width:28,height:28,cursor:"pointer",fontSize:16,color:"#fff",fontWeight:700}}>+</button>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setLundi(d=>addDays(d,-7));setJourActif(0);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#fff",fontSize:16,fontWeight:700}}>←</button>
                <button onClick={()=>{setLundi(getLundi(today));setJourActif(0);}} style={{background:"rgba(255,255,255,0.9)",border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#1e40af",fontSize:12,fontWeight:700,fontFamily:F}}>Auj.</button>
                <button onClick={()=>{setLundi(d=>addDays(d,7));setJourActif(0);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#fff",fontSize:16,fontWeight:700}}>→</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMobile ? (
        /* ── Vue MOBILE : un jour à la fois ── */
        <div>
          {/* Sélecteur jour horizontal */}
          <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{display:"flex",minWidth:"max-content",padding:"0 8px"}}>
              {jours7.map((date,idx)=>{
                const nb=Object.values(menuSemaine[dateKey(date)]||{}).reduce((a,r)=>a+r.length,0);
                const actif=idx===jourActif;
                const auj=isToday(date);
                return(
                  <button key={idx} onClick={()=>setJourActif(idx)} style={{border:"none",background:"none",padding:"12px 14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:actif?"3px solid #1d4ed8":"3px solid transparent",minWidth:60}}>
                    <span style={{fontSize:11,fontWeight:700,color:actif?"#1d4ed8":"#94a3b8",fontFamily:F,textTransform:"uppercase"}}>{JOURS_COURT[idx]}</span>
                    <span style={{fontSize:20,fontWeight:800,color:actif?"#1d4ed8":auj?"#1d4ed8":"#1e293b",fontFamily:F,background:auj&&!actif?"#dbeafe":"transparent",borderRadius:999,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}>{date.getDate()}</span>
                    {nb>0&&<span style={{background:"#1d4ed8",color:"#fff",borderRadius:999,fontSize:10,fontWeight:700,padding:"1px 6px",fontFamily:F}}>{nb}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu du jour actif */}
          <div style={{padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:18,color:"#1e293b",fontFamily:F}}>{JOURS_FULL[jourActif]} {fmtDate(dateActif)}</div>
              {Object.values(jourMenuActif).some(r=>r.length>0)&&<button onClick={()=>vider(dkActif)} style={{border:"none",background:"#fff1f2",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,color:"#ef4444",fontFamily:F,fontWeight:600}}>Vider</button>}
            </div>
            {REPAS_TYPES.map(rt=>{
              const plats=jourMenuActif[rt]||[];
              return(
                <div key={rt} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,marginBottom:12,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",borderBottom:plats.length?"1px solid #f1f5f9":"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#334155",fontFamily:F}}>{rt}</span>
                    <button onClick={()=>setPicker({dk:dkActif,rt})} style={{background:"#eff6ff",color:"#1d4ed8",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:F}}>+ Ajouter</button>
                  </div>
                  {plats.length>0&&(
                    <div style={{padding:"8px 14px",display:"flex",flexDirection:"column",gap:6}}>
                      {plats.map(rid=>{const r=recettes.find(x=>x.id===rid);if(!r)return null;return(
                        <div key={rid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{r.categorie?.split(" ")[0]||"🍽️"}</span><span style={{fontWeight:600,fontSize:14,color:"#1e293b",fontFamily:F}}>{r.nom}</span></div>
                          <button onClick={()=>remPlat(dkActif,rt,rid)} style={{border:"none",background:"#fee2e2",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#ef4444",fontSize:14}}>×</button>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bilan mobile */}
          {totalP>0&&(
            <div style={{margin:"0 16px 16px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:16,padding:"16px"}}>
              <h3 style={{margin:"0 0 12px",fontSize:16,fontWeight:800,color:"#1e293b",fontFamily:F}}>🛒 Bilan semaine</h3>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{l:"OK",c:bilan.filter(b=>b.status==="ok").length,co:"#16a34a",bg:"#d1fae5"},{l:"Partiel",c:bilan.filter(b=>b.status==="insuffisant").length,co:"#f97316",bg:"#ffedd5"},{l:"Manquant",c:bilan.filter(b=>b.status==="absent").length,co:"#ef4444",bg:"#fee2e2"}].map(s=>(
                  <div key={s.l} style={{flex:1,background:s.bg,borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:20,color:s.co,fontFamily:F}}>{s.c}</div>
                    <div style={{fontSize:11,color:"#475569",fontFamily:F}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {bilan.map((b,i)=>{const s=SS[b.status];return(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:s.bg,border:`1px solid ${s.br}`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span>{s.ic}</span><span style={{fontWeight:600,fontSize:13,color:"#1e293b",fontFamily:F}}>{b.nom}</span></div>
                    <span style={{fontSize:12,fontWeight:700,color:s.co,fontFamily:F}}>{parseFloat(b.total.toFixed(2))} {b.unite}</span>
                  </div>
                );})}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Vue PC : grille 7 jours ── */
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 20px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10,marginBottom:28}}>
            {jours7.map((date,idx)=>{
              const dk=dateKey(date),jM=menuSemaine[dk]||{},nbPJ=Object.values(jM).reduce((a,r)=>a+r.length,0),estAuj=isToday(date);
              return(
                <div key={dk} style={{background:"#fff",border:estAuj?"2px solid #1d4ed8":"1.5px solid #e2e8f0",borderRadius:16,overflow:"hidden",boxShadow:estAuj?"0 4px 16px rgba(29,78,216,0.15)":"0 2px 8px rgba(0,0,0,0.04)",minHeight:260,display:"flex",flexDirection:"column"}}>
                  <div style={{background:estAuj?"#1d4ed8":"#f8fafc",padding:"10px 12px",borderBottom:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:800,fontSize:12,color:estAuj?"#fff":"#64748b",fontFamily:F,textTransform:"uppercase"}}>{JOURS_COURT[idx]}</div>
                    <div style={{fontWeight:700,fontSize:20,color:estAuj?"#fff":"#1e293b",fontFamily:F,lineHeight:1,marginTop:2}}>{date.getDate()}</div>
                    <div style={{fontSize:11,color:estAuj?"rgba(255,255,255,0.7)":"#94a3b8",fontFamily:F}}>{MOIS_NOMS[date.getMonth()]}</div>
                    {nbPJ>0&&<div style={{marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{background:estAuj?"rgba(255,255,255,0.2)":"#dbeafe",color:estAuj?"#fff":"#1e40af",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700,fontFamily:F}}>{nbPJ}</span>
                      <button onClick={()=>vider(dk)} style={{border:"none",background:"none",cursor:"pointer",fontSize:11,color:estAuj?"rgba(255,255,255,0.6)":"#ef4444",fontFamily:F,padding:0}}>Vider</button>
                    </div>}
                  </div>
                  <div style={{flex:1,padding:"8px",display:"flex",flexDirection:"column",gap:5}}>
                    {REPAS_TYPES.map(rt=>{const plats=jM[rt]||[];return(
                      <div key={rt}>
                        <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",fontFamily:F,textTransform:"uppercase",marginBottom:2}}>{rt}</div>
                        {plats.map(rid=>{const r=recettes.find(x=>x.id===rid);if(!r)return null;return(<div key={rid} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 7px",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,fontWeight:600,color:"#1e40af",fontFamily:F}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{r.nom}</span><button onClick={()=>remPlat(dk,rt,rid)} style={{border:"none",background:"none",cursor:"pointer",color:"#93c5fd",fontSize:12,padding:"0 0 0 3px"}}>×</button></div>);})}
                        <button onClick={()=>setPicker({dk,rt})} style={{border:"1.5px dashed #cbd5e1",background:"none",borderRadius:6,padding:"2px 0",cursor:"pointer",fontSize:10,color:"#94a3b8",width:"100%",fontFamily:F,fontWeight:600}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#1d4ed8";e.currentTarget.style.color="#1d4ed8";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#cbd5e1";e.currentTarget.style.color="#94a3b8";}}>+ ajouter</button>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Bilan PC */}
          {totalP>0&&(
            <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:20,padding:"24px 28px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
                <div><h3 style={{margin:0,fontSize:20,fontWeight:800,color:"#1e293b",fontFamily:F}}>🛒 Bilan ingrédients</h3><p style={{margin:"4px 0 0",color:"#64748b",fontSize:13,fontFamily:F}}>Pour {nbP} personne{nbP>1?"s":""}</p></div>
                <div style={{display:"flex",gap:10}}>{Object.entries(SS).map(([k,s])=><span key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontFamily:F,color:"#475569"}}><span style={{width:10,height:10,borderRadius:999,background:s.dot,display:"inline-block"}}/>{s.label}</span>)}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                {bilan.map((b,i)=>{const s=SS[b.status],pct=b.status==="ok"?100:b.status==="absent"?0:Math.round(b.dispo/b.total*100);return(
                  <div key={i} style={{background:s.bg,border:`1.5px solid ${s.br}`,borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div><div style={{fontWeight:700,fontSize:14,color:"#1e293b",fontFamily:F}}>{b.nom}</div><div style={{fontSize:12,color:"#64748b",fontFamily:F}}>Besoin : <strong style={{color:s.co}}>{parseFloat(b.total.toFixed(2))} {b.unite}</strong>{b.status!=="absent"&&<span> · Dispo : {parseFloat(b.dispo.toFixed(2))}</span>}</div></div>
                      <span style={{background:"rgba(255,255,255,0.6)",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:700,color:s.co,fontFamily:F,whiteSpace:"nowrap"}}>{b.status==="ok"?"✅ OK":b.status==="insuffisant"?"⚠️ Partiel":"❌ Manquant"}</span>
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.5)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",borderRadius:999,width:`${pct}%`,background:s.dot}}/></div>
                  </div>
                );})}
              </div>
            </div>
          )}
          {totalP===0&&<div style={{textAlign:"center",padding:"40px",background:"#fff",borderRadius:20,border:"1.5px dashed #cbd5e1"}}><div style={{fontSize:48,marginBottom:12}}>🍽️</div><div style={{fontSize:18,fontWeight:700,color:"#334155",fontFamily:F}}>Planifiez vos repas</div><div style={{fontSize:14,color:"#94a3b8",marginTop:6,fontFamily:F}}>Cliquez sur "+ ajouter" pour choisir une recette</div></div>}
        </div>
      )}

      {/* Modal picker recette */}
      <Modal open={!!picker} onClose={()=>{setPicker(null);setSearchR("");}} title={picker?`${picker.rt}`:""}> 
        {picker&&(
          <div>
            <input style={{...iS,marginBottom:14}} placeholder="🔍 Rechercher..." value={searchR} onChange={e=>setSearchR(e.target.value)} autoFocus/>
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:380,overflowY:"auto"}}>
              {recsF.map(r=>{const deja=(menuSemaine[picker.dk]?.[picker.rt]||[]).includes(r.id);return(
                <button key={r.id} onClick={()=>!deja&&addPlat(picker.dk,picker.rt,r.id)} style={{display:"flex",alignItems:"center",gap:12,background:deja?"#f1f5f9":"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px 14px",cursor:deja?"not-allowed":"pointer",textAlign:"left",opacity:deja?0.5:1}}
                  onMouseEnter={e=>{if(!deja){e.currentTarget.style.borderColor="#1d4ed8";e.currentTarget.style.background="#eff6ff";}}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background=deja?"#f1f5f9":"#fff";}}>
                  <span style={{fontSize:30}}>{r.categorie?.split(" ")[0]||"🍽️"}</span>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F}}>{r.nom}</div><div style={{fontSize:12,color:"#64748b",fontFamily:F}}>⏱ {(r.tempsPrep||0)+(r.tempsCuisson||0)} min</div></div>
                  {!deja&&<span style={{background:"#dbeafe",color:"#1e40af",borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,fontFamily:F}}>Ajouter</span>}
                </button>
              );})}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Page Liste de Courses ────────────────────
function PageCourses({products,pieces,isMobile}){
  const [liste,setListe]=useState([]); // [{id,nom,categorie,quantite,unite,qteType,piece,checked,source}]
  const [coursesDB,setCoursesDB]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [newItem,setNewItem]=useState({nom:"",categorie:CATEGORIES[0],quantite:1,unite:"unité",qteType:"entier",fracPart:0,piece:pieces[0]||""});
  const [filterCat,setFilterCat]=useState("Toutes");
  const [showImport,setShowImport]=useState(false);

  // Écoute Firebase pour la liste de courses partagée
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"courses"),s=>{
      setCoursesDB(s.docs.map(d=>d.data()));
    });
    return unsub;
  },[]);

  // Produits manquants ou en alerte dans l'inventaire
  const produitsMissing=products.filter(p=>
    p.quantite<=0||(p.seuilAlerte&&p.quantite<=parseFloat(p.seuilAlerte))
  );

  // Ajouter un item manuellement
  const addItem=async()=>{
    if(!newItem.nom.trim())return alert("Nom obligatoire.");
    const qte=newItem.qteType==="fraction"?parseFloat(newItem.quantite||0)+parseFloat(newItem.fracPart||0):parseFloat(newItem.quantite||0);
    const item={id:mkId(),nom:newItem.nom,categorie:newItem.categorie,quantite:qte,unite:newItem.unite,qteType:newItem.qteType,piece:newItem.piece,checked:false,source:"manuel"};
    await setDoc(doc(db,"courses",item.id),item);
    setNewItem({nom:"",categorie:CATEGORIES[0],quantite:1,unite:"unité",qteType:"entier",fracPart:0,piece:pieces[0]||""});
    setShowAdd(false);
  };

  // Importer les produits manquants
  const importerManquants=async(selected)=>{
    for(const p of selected){
      const deja=coursesDB.find(c=>c.nom===p.nom&&!c.checked);
      if(deja) continue;
      const item={id:mkId(),nom:p.nom,categorie:p.categorie,quantite:p.seuilAlerte?Math.max(0,parseFloat(p.seuilAlerte)-p.quantite):1,unite:p.unite||"unité",qteType:p.qteType||"entier",piece:p.piece||"",checked:false,source:"inventaire"};
      await setDoc(doc(db,"courses",item.id),item);
    }
    setShowImport(false);
  };

  // Cocher / décocher
  const toggleCheck=async(item)=>{
    await setDoc(doc(db,"courses",item.id),{...item,checked:!item.checked});
  };

  // Supprimer un item
  const deleteItem=async(id)=>{ await deleteDoc(doc(db,"courses",id)); };

  // Vider les cochés
  const viderCoches=async()=>{
    const coches=coursesDB.filter(c=>c.checked);
    for(const c of coches) await deleteDoc(doc(db,"courses",c.id));
  };

  // Tout vider
  const toutVider=async()=>{
    if(!window.confirm("Vider toute la liste ?")) return;
    for(const c of coursesDB) await deleteDoc(doc(db,"courses",c.id));
  };

  // ★ AJOUTER À L'INVENTAIRE les items cochés
  const ajouterAInventaire=async()=>{
    const coches=coursesDB.filter(c=>c.checked);
    if(!coches.length) return alert("Cochez d'abord les articles achetés.");
    for(const item of coches){
      // Cherche si le produit existe déjà dans l'inventaire
      const existing=products.find(p=>p.nom.toLowerCase()===item.nom.toLowerCase());
      if(existing){
        // Ajoute la quantité au produit existant
        await setDoc(doc(db,"produits",existing.id),{...existing,quantite:existing.quantite+item.quantite});
      } else {
        // Crée un nouveau produit
        const id=mkId();
        await setDoc(doc(db,"produits",id),{
          id,nom:item.nom,categorie:item.categorie,quantite:item.quantite,
          unite:item.unite,qteType:item.qteType,piece:item.piece||pieces[0]||"Cuisine",
          description:"",seuilAlerte:"",
        });
      }
      // Supprime de la liste de courses
      await deleteDoc(doc(db,"courses",item.id));
    }
    alert(`✅ ${coches.length} article${coches.length>1?"s":""} ajouté${coches.length>1?"s":""} à l'inventaire !`);
  };

  const filtered=coursesDB.filter(c=>filterCat==="Toutes"||c.categorie===filterCat);
  const nonCoches=filtered.filter(c=>!c.checked);
  const coches=filtered.filter(c=>c.checked);
  const nbCoches=coursesDB.filter(c=>c.checked).length;

  const [newFrac,setNewFrac]=useState(0);

  return(
    <div style={{paddingBottom:isMobile?90:0}}>
      {/* Header orange */}
      <div style={{background:"linear-gradient(135deg,#ea580c,#dc2626)",padding:isMobile?"20px 16px 16px":"24px 28px 20px",color:"#fff"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:isMobile?26:30}}>🛒</span>
                <h1 style={{margin:0,fontSize:isMobile?22:26,fontWeight:800,fontFamily:F}}>Liste de Courses</h1>
              </div>
              <p style={{margin:"4px 0 0",opacity:0.8,fontSize:13,fontFamily:F}}>{coursesDB.length} article{coursesDB.length>1?"s":""} · {nbCoches} coché{nbCoches>1?"s":""} · sync 🔄</p>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>setShowImport(true)} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:12,padding:"10px 16px",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:F}}>⚠️ Manquants</button>
              <button onClick={()=>setShowAdd(true)} style={{background:"#fff",color:"#ea580c",border:"none",borderRadius:12,padding:"10px 18px",cursor:"pointer",fontWeight:800,fontSize:15,fontFamily:F,boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>+ Ajouter</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:isMobile?"16px":"24px 28px"}}>
        {/* Actions globales */}
        {coursesDB.length>0&&(
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            {nbCoches>0&&(
              <button onClick={ajouterAInventaire} style={{background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",border:"none",borderRadius:12,padding:"12px 20px",cursor:"pointer",fontWeight:800,fontSize:15,fontFamily:F,boxShadow:"0 4px 12px rgba(21,128,61,0.3)",display:"flex",alignItems:"center",gap:8}}>
                📦 Ajouter à l'inventaire ({nbCoches})
              </button>
            )}
            {nbCoches>0&&(
              <button onClick={viderCoches} style={{background:"#fff7ed",color:"#ea580c",border:"1.5px solid #fed7aa",borderRadius:12,padding:"12px 16px",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:F}}>
                🗑️ Supprimer les cochés
              </button>
            )}
            <button onClick={toutVider} style={{background:"#fff1f2",color:"#e11d48",border:"1.5px solid #fecdd3",borderRadius:12,padding:"12px 16px",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:F,marginLeft:"auto"}}>
              Tout vider
            </button>
          </div>
        )}

        {/* Filtre catégorie */}
        {coursesDB.length>0&&(
          <div style={{marginBottom:16}}>
            <select style={{...iS,width:isMobile?"100%":"220px"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="Toutes">Toutes catégories</option>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Liste vide */}
        {coursesDB.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px",background:"#fff",borderRadius:20,border:"1.5px dashed #fed7aa"}}>
            <div style={{fontSize:56,marginBottom:12}}>🛒</div>
            <div style={{fontSize:18,fontWeight:700,color:"#334155",fontFamily:F,marginBottom:8}}>Liste de courses vide</div>
            <p style={{color:"#94a3b8",fontFamily:F,fontSize:14,marginBottom:20}}>Ajoutez des articles manuellement ou importez les produits manquants de votre inventaire.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setShowImport(true)} style={{background:"#fff7ed",color:"#ea580c",border:"1.5px solid #fed7aa",borderRadius:12,padding:"12px 20px",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:F}}>⚠️ Voir les manquants</button>
              <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#ea580c,#dc2626)",color:"#fff",border:"none",borderRadius:12,padding:"12px 20px",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:F}}>+ Ajouter manuellement</button>
            </div>
          </div>
        )}

        {/* Articles à acheter */}
        {nonCoches.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontWeight:700,fontSize:14,color:"#475569",fontFamily:F,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>
              À acheter — {nonCoches.length} article{nonCoches.length>1?"s":""}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {nonCoches.map(item=>(
                <div key={item.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 2px 6px rgba(0,0,0,0.04)"}}>
                  <button onClick={()=>toggleCheck(item)} style={{width:26,height:26,borderRadius:999,border:"2px solid #e2e8f0",background:"#fff",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}/>
                  <div style={{width:44,height:44,background:"linear-gradient(135deg,#fff7ed,#fed7aa)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{getEmoji(item.categorie)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F}}>{item.nom}</div>
                    <div style={{fontSize:12,color:"#64748b",fontFamily:F,marginTop:2}}>
                      {item.categorie?.replace(/^[^\s]+ /,"")}
                      {item.source==="inventaire"&&<span style={{marginLeft:6,background:"#ffedd5",color:"#c2410c",borderRadius:999,padding:"1px 7px",fontSize:11,fontWeight:600}}>stock bas</span>}
                    </div>
                  </div>
                  <div style={{fontWeight:700,fontSize:15,color:"#ea580c",fontFamily:F,flexShrink:0}}>
                    {formatQte(item.quantite,item.unite,item.qteType)}
                  </div>
                  <button onClick={()=>deleteItem(item.id)} style={{border:"none",background:"#fff1f2",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:14,color:"#e11d48",flexShrink:0}}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Articles cochés */}
        {coches.length>0&&(
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#94a3b8",fontFamily:F,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>
              ✅ Achetés — {coches.length}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {coches.map(item=>(
                <div key={item.id} style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,opacity:0.65}}>
                  <button onClick={()=>toggleCheck(item)} style={{width:26,height:26,borderRadius:999,border:"2px solid #16a34a",background:"#16a34a",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff"}}>✓</button>
                  <div style={{width:44,height:44,background:"#f1f5f9",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{getEmoji(item.categorie)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:15,color:"#64748b",fontFamily:F,textDecoration:"line-through"}}>{item.nom}</div>
                    <div style={{fontSize:12,color:"#94a3b8",fontFamily:F}}>{formatQte(item.quantite,item.unite,item.qteType)}</div>
                  </div>
                  <button onClick={()=>deleteItem(item.id)} style={{border:"none",background:"#f1f5f9",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:14,color:"#94a3b8",flexShrink:0}}>🗑️</button>
                </div>
              ))}
            </div>
            {/* Bouton ajouter à l'inventaire en bas aussi */}
            <button onClick={ajouterAInventaire} style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",border:"none",borderRadius:14,padding:"14px 0",cursor:"pointer",fontWeight:800,fontSize:16,fontFamily:F,boxShadow:"0 4px 12px rgba(21,128,61,0.3)"}}>
              📦 Ajouter à l'inventaire ({coches.length} article{coches.length>1?"s":""})
            </button>
          </div>
        )}
      </div>

      {/* Modal ajout manuel */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="➕ Ajouter un article">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:14,background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:14,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:40}}>{getEmoji(newItem.categorie)}</div>
            <div style={{fontWeight:700,fontSize:15,color:"#1e293b",fontFamily:F}}>{newItem.nom||"Nom de l'article"}</div>
          </div>
          <Lbl label="Nom *"><input style={iS} value={newItem.nom} onChange={e=>setNewItem(x=>({...x,nom:e.target.value}))} placeholder="Ex : Lait, Pain, Shampoing..."/></Lbl>
          <Lbl label="Catégorie"><select style={iS} value={newItem.categorie} onChange={e=>setNewItem(x=>({...x,categorie:e.target.value}))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Lbl>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Lbl label="Type"><select style={iS} value={newItem.qteType} onChange={e=>setNewItem(x=>({...x,qteType:e.target.value}))}>{QUANTITE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></Lbl>
            <Lbl label="Unité"><select style={iS} value={newItem.unite} onChange={e=>setNewItem(x=>({...x,unite:e.target.value}))}>{UNITES.map(u=><option key={u.value} value={u.value}>{u.label}</option>)}</select></Lbl>
          </div>
          <div style={{display:"grid",gridTemplateColumns:newItem.qteType==="fraction"?"1fr 1fr":"1fr",gap:12}}>
            <Lbl label="Quantité"><input style={iS} type="number" min="0" value={newItem.quantite} onChange={e=>setNewItem(x=>({...x,quantite:e.target.value}))}/></Lbl>
            {newItem.qteType==="fraction"&&<Lbl label="Fraction"><select style={iS} value={newFrac} onChange={e=>setNewFrac(e.target.value)}><option value={0}>Aucune</option>{FRACTIONS.map(x=><option key={x.label} value={x.value}>{x.label}</option>)}</select></Lbl>}
          </div>
          <Lbl label="Pièce de destination"><select style={iS} value={newItem.piece} onChange={e=>setNewItem(x=>({...x,piece:e.target.value}))}>{pieces.map(p=><option key={p}>{p}</option>)}</select></Lbl>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={addItem} style={{...btnP,background:"linear-gradient(135deg,#ea580c,#dc2626)"}}>✅ Ajouter à la liste</button>
            <button onClick={()=>setShowAdd(false)} style={btnS}>Annuler</button>
          </div>
        </div>
      </Modal>

      {/* Modal import manquants */}
      <Modal open={showImport} onClose={()=>setShowImport(false)} title="⚠️ Produits manquants / en alerte">
        <div>
          {produitsMissing.length===0?(
            <div style={{textAlign:"center",padding:"30px 0",color:"#64748b",fontFamily:F}}>
              <div style={{fontSize:40,marginBottom:8}}>✅</div>
              <div style={{fontWeight:600,fontSize:15}}>Tout votre inventaire est bien approvisionné !</div>
            </div>
          ):(
            <>
              <p style={{color:"#64748b",fontSize:14,fontFamily:F,marginBottom:16}}>Sélectionnez les produits à ajouter à votre liste de courses.</p>
              <ImportManquants produits={produitsMissing} coursesDB={coursesDB} onImport={importerManquants} onCancel={()=>setShowImport(false)}/>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ImportManquants({produits,coursesDB,onImport,onCancel}){
  const [selected,setSelected]=useState(produits.map(p=>p.id));
  const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const selAll=()=>setSelected(produits.map(p=>p.id));
  const selNone=()=>setSelected([]);
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={selAll} style={{...btnS,padding:"8px 0",fontSize:13,flex:1}}>Tout sélectionner</button>
        <button onClick={selNone} style={{...btnS,padding:"8px 0",fontSize:13,flex:1}}>Tout déselectionner</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16,maxHeight:340,overflowY:"auto"}}>
        {produits.map(p=>{
          const sel=selected.includes(p.id);
          const dejaListe=coursesDB.find(c=>c.nom===p.nom&&!c.checked);
          const empty=p.quantite<=0;
          return(
            <div key={p.id} onClick={()=>!dejaListe&&toggle(p.id)} style={{display:"flex",alignItems:"center",gap:12,background:sel?"#fff7ed":"#f8fafc",border:`1.5px solid ${sel?"#fed7aa":"#e2e8f0"}`,borderRadius:12,padding:"12px 14px",cursor:dejaListe?"not-allowed":"pointer",opacity:dejaListe?0.5:1}}>
              <div style={{width:24,height:24,borderRadius:999,border:`2px solid ${sel?"#ea580c":"#e2e8f0"}`,background:sel?"#ea580c":"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",flexShrink:0}}>{sel?"✓":""}</div>
              <div style={{fontSize:24}}>{getEmoji(p.categorie)}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1e293b",fontFamily:F}}>{p.nom}</div>
                <div style={{fontSize:12,color:"#64748b",fontFamily:F,marginTop:1}}>
                  Stock : <span style={{color:empty?"#ef4444":"#f97316",fontWeight:700}}>{formatQte(p.quantite,p.unite||"unité",p.qteType||"entier")}</span>
                  {p.seuilAlerte&&<span style={{marginLeft:6}}>/ seuil : {p.seuilAlerte} {p.unite}</span>}
                  {dejaListe&&<span style={{marginLeft:6,background:"#dbeafe",color:"#1e40af",borderRadius:999,padding:"1px 7px",fontSize:11,fontWeight:600}}>déjà dans la liste</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>onImport(produits.filter(p=>selected.includes(p.id)))} disabled={!selected.length} style={{...btnP,background:"linear-gradient(135deg,#ea580c,#dc2626)",opacity:selected.length?1:0.5}}>
          Ajouter {selected.length} article{selected.length>1?"s":""} à la liste
        </button>
        <button onClick={onCancel} style={btnS}>Annuler</button>
      </div>
    </div>
  );
}

// ── App principale ───────────────────────────
export default function App(){
  const isMobile=useIsMobile();
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [loginLoading,setLoginLoading]=useState(false);
  const [page,setPage]=useState("inventaire");
  const [products,setProducts]=useState([]);
  const [recettes,setRecettes]=useState([]);
  const [pieces,setPieces]=useState(PIECES_DEFAULT);
  const [menuSemaine,setMenuSemaine]=useState({});
  const [dataLoading,setDataLoading]=useState(true);

  useEffect(()=>{const u=onAuthStateChanged(auth,u=>{setUser(u);setAuthLoading(false);});return u;},[]);
  const handleLogin=async()=>{setLoginLoading(true);try{await signInWithPopup(auth,provider);}catch(e){console.error(e);}finally{setLoginLoading(false);};};

  useEffect(()=>{
    if(!user)return;
    setDataLoading(true);
    let L={p:false,r:false,c:false,m:false};
    const chk=()=>{if(L.p&&L.r&&L.c&&L.m)setDataLoading(false);};
    const uP=onSnapshot(collection(db,"produits"),s=>{setProducts(s.docs.map(d=>d.data()));L.p=true;chk();});
    const uR=onSnapshot(collection(db,"recettes"),s=>{
      const data=s.docs.map(d=>d.data());
      if(!data.length){RECETTES_DEMO.forEach(r=>setDoc(doc(db,"recettes",r.id),r));setRecettes(RECETTES_DEMO);}
      else setRecettes(data);
      L.r=true;chk();
    });
    const uC=onSnapshot(doc(db,"config","pieces"),s=>{if(s.exists())setPieces(s.data().liste||PIECES_DEFAULT);L.c=true;chk();});
    const uM=onSnapshot(collection(db,"menu"),s=>{const m={};s.docs.forEach(d=>{m[d.id]=d.data();});setMenuSemaine(m);L.m=true;chk();});
    return()=>{uP();uR();uC();uM();};
  },[user]);

  const Loader=({msg,sub})=>(
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
        <div style={{textAlign:"center",color:"#64748b",fontFamily:F}}><div style={{fontSize:48,marginBottom:12}}>🏠</div><div style={{fontSize:16,fontWeight:600}}>{msg}</div>{sub&&<div style={{fontSize:13,marginTop:6,opacity:0.7}}>{sub}</div>}</div>
      </div>
    </>
  );

  if(authLoading) return <Loader msg="Chargement..."/>;
  if(!user) return <LoginScreen onLogin={handleLogin} loading={loginLoading}/>;
  if(dataLoading) return <Loader msg="Synchronisation..." sub="Connexion à la base familiale"/>;

  return(
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:F}}>
        {!isMobile&&<NavBarPC page={page} setPage={setPage} user={user} onLogout={()=>signOut(auth)}/>}
        {page==="inventaire"?<PageInventaire products={products} pieces={pieces} setPieces={setPieces} isMobile={isMobile}/>
        :page==="recettes"?<PageRecettes products={products} recettes={recettes} isMobile={isMobile}/>
        :page==="menu"?<PageMenu products={products} recettes={recettes} menuSemaine={menuSemaine} isMobile={isMobile}/>
        :<PageCourses products={products} pieces={pieces} isMobile={isMobile}/>}
        {isMobile&&<NavBarMobile page={page} setPage={setPage}/>}
      </div>
    </>
  );
}
