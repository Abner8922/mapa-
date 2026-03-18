let map = L.map('map').setView([-25.43,-49.27],13)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

let terminalEscolhido=null
let rotas={}
let pontosLinha=[]
let rotasAtuais=[]
let camadas=[]

let terminais={
"Terminal Boqueirão":[-25.517,-49.230],
"Terminal Cabral":[-25.406,-49.252],
"Terminal Portão":[-25.478,-49.293],
"Terminal Pinheirinho":[-25.538,-49.293],
"Terminal Capão Raso":[-25.506,-49.291]
}


// ================= STATUS FAKE =================
function gerarStatus(){
let r = Math.random()

if(r < 0.2) return "🔴 Defeito"
if(r < 0.5) return "🟡 Atrasado"
return "🟢 Normal"
}


// ================= FETCH =================
fetch("2026_03_11_shapeLinha.json")
.then(r=>r.json())
.then(data=>{
data.forEach(p=>{
let lat=parseFloat(p.LAT.replace(",",".")) 
let lon=parseFloat(p.LON.replace(",","."))

if(!rotas[p.COD]) rotas[p.COD]=[]
rotas[p.COD].push([lat,lon])
})
})

fetch("2026_03_16_pontosLinha.json")
.then(r=>r.json())
.then(data=>{
data.forEach(p=>{
pontosLinha.push({
linha:p.COD,
lat:parseFloat(p.LAT.replace(",",".")),
lon:parseFloat(p.LON.replace(",",".")),
nome:p.NOME
})
})
})


// ================= TERMINAL =================
function confirmarTerminal(){
let nome=document.getElementById("terminalSelect").value
terminalEscolhido=terminais[nome]

L.marker(terminalEscolhido).addTo(map)
map.setView(terminalEscolhido,14)

document.getElementById("popupTerminal").style.display="none"
}


// ================= BUSCA =================
function buscarRota(){

let destino=document.getElementById("destino").value

fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${destino}`)
.then(r=>r.json())
.then(data=>{

let lat=parseFloat(data[0].lat)
let lon=parseFloat(data[0].lon)

calcularRota(terminalEscolhido[0],terminalEscolhido[1],lat,lon)

})
}


// ================= LÓGICA =================

function pontosProximos(lat,lon){
return pontosLinha.filter(p=>map.distance([lat,lon],[p.lat,p.lon])<700)
}

function distancia(a,b){
return map.distance([a.lat,a.lon],[b.lat,b.lon])
}

// encontrar ponto de troca REAL
function encontrarBaldeacao(l1,l2){

let p1=pontosLinha.filter(p=>p.linha==l1)
let p2=pontosLinha.filter(p=>p.linha==l2)

for(let a of p1){
for(let b of p2){
if(map.distance([a.lat,a.lon],[b.lat,b.lon])<200){
return a
}
}
}
return null
}


// cortar trajeto correto
function cortarTrecho(cod, inicio, fim){

let linha = rotas[cod]

let start = linha.findIndex(p=>map.distance(p,[inicio.lat,inicio.lon])<200)
let end = linha.findIndex(p=>map.distance(p,[fim.lat,fim.lon])<200)

if(start==-1 || end==-1) return linha

if(start < end){
return linha.slice(start,end)
}else{
return linha.slice(end,start)
}
}


function calcularRota(latO,lonO,latD,lonD){

let origem=pontosProximos(latO,lonO)
let destino=pontosProximos(latD,lonD)

let rotasPossiveis=[]

// sem baldeação
origem.forEach(o=>{
destino.forEach(d=>{
if(o.linha==d.linha){
rotasPossiveis.push({
linhas:[o.linha],
embarque:o,
desembarque:d
})
}
})
})

// com baldeação REAL
origem.forEach(o=>{
destino.forEach(d=>{
if(o.linha!=d.linha){

let troca=encontrarBaldeacao(o.linha,d.linha)
if(!troca) return

rotasPossiveis.push({
linhas:[o.linha,d.linha],
embarque:o,
baldeacao:troca,
desembarque:d
})

}
})
})


// remove duplicadas
let unicas=[]
let set=new Set()

rotasPossiveis.forEach(r=>{
let key=r.linhas.join("-")+r.embarque.nome+r.desembarque.nome
if(!set.has(key)){
set.add(key)
unicas.push(r)
}
})

// calcula tempo melhor
unicas.forEach(r=>{
r.tempo = Math.round(
(distancia({lat:latO,lon:lonO}, r.embarque)/80) +
(distancia(r.embarque,r.desembarque)/120) +
(r.linhas.length*10)
)
})

// ordena
unicas.sort((a,b)=>a.tempo-b.tempo)

// top 3
rotasAtuais = unicas.slice(0,3)

mostrarRotas()
}


// ================= UI =================

function mostrarRotas(){

let html="<h3>Melhores rotas</h3>"

rotasAtuais.forEach((r,i)=>{

let status1 = gerarStatus()
let status2 = r.linhas[1] ? gerarStatus() : ""

html+=`
<div class="rota" onclick="selecionarRota(${i})">

<b>Rota ${i+1}</b><br>

🚌 Linha ${r.linhas[0]} (${status1})<br>

${r.linhas.length>1 
? `🔁 Trocar para linha ${r.linhas[1]} (${status2})<br>` 
: ""}

📍 ${r.embarque.nome}

</div>
`
})

document.getElementById("info").innerHTML=html
}


// ================= MAPA =================

function limparMapa(){
camadas.forEach(c=>map.removeLayer(c))
camadas=[]
}

function selecionarRota(i){

limparMapa()

let r = rotasAtuais[i]

// cor dinâmica
let cor = r.linhas.length>1 ? "orange" : "blue"

// caminhada
let c1 = L.polyline(
[[terminalEscolhido[0],terminalEscolhido[1]],[r.embarque.lat,r.embarque.lon]],
{dashArray:"5,10",color:"gray"}
).addTo(map)

camadas.push(c1)


// linha 1
let trecho1 = cortarTrecho(r.linhas[0], r.embarque, r.baldeacao || r.desembarque)

let l1 = L.polyline(trecho1,{
color:cor,
weight:6
}).addTo(map)

camadas.push(l1)


// baldeação
if(r.baldeacao){

let m = L.marker([r.baldeacao.lat,r.baldeacao.lon])
.addTo(map)
.bindPopup("🔁 Troque de ônibus aqui")

camadas.push(m)


// linha 2
let trecho2 = cortarTrecho(r.linhas[1], r.baldeacao, r.desembarque)

let l2 = L.polyline(trecho2,{
color:"purple",
weight:6
}).addTo(map)

camadas.push(l2)

}


// caminhada final
let c2 = L.polyline(
[[r.desembarque.lat,r.desembarque.lon],[...map.getCenter()]],
{dashArray:"5,10",color:"gray"}
).addTo(map)

camadas.push(c2)


// zoom
let grupo = L.featureGroup(camadas)
map.fitBounds(grupo.getBounds())
}