let map = L.map('map').setView([-25.42,-49.27],12)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:18
}).addTo(map)

let rotaAtual = []
let onibus
let movimento
let rotasCuritiba = {}


// 20 linhas
const nomesLinhas = {

"203":"Santa Cândida / Capão Raso",
"181":"Mateus Leme",
"182":"Abranches",
"183":"Jd. Chaparral",
"184":"Vila Suíça",
"175":"Bom Retiro / PUC",
"176":"Parque Tanguá",
"177":"Cabral / Parque Tanguá",
"205":"Barreirinha",
"272":"Paineiras",
"260":"Marechal Hermes",
"265":"Ahú / Los Angeles",
"274":"Santa Gema",
"275":"F. Noronha / Laranjeiras",
"280":"Nossa Senhora de Nazaré",
"150":"C. Música / V. Alegre",
"160":"Jd Mercês / Guanabara",
"164":"R. Prado / C. Gomes",
"166":"Vila Nori",
"168":"Raposo Tavares"

}


// destinos
const destinos = {

puc:["175","203"],

centro:["203","181","260","265"],

cabral:["177","181","182"],

tangua:["176","177"],

barreirinha:["205","272"],

ahu:["265","274"]

}


// carregar JSON
fetch("2026_03_11_shapeLinha.json")
.then(res=>res.json())
.then(data=>{

data.forEach(p=>{

let codigo = p.COD

let lat = parseFloat(p.LAT.replace(",","."))
let lon = parseFloat(p.LON.replace(",","."))

if(!rotasCuritiba[codigo]){
rotasCuritiba[codigo] = []
}

rotasCuritiba[codigo].push([lat,lon])

})

})



function buscarRotas(){

let destino = document.getElementById("destino").value
let linhas = destinos[destino]

document.getElementById("status").innerHTML = ""

let linhaValida = null

linhas.forEach(l=>{

let status = Math.random()

let texto = ""

if(status < 0.6){
texto = "🟢 Linha "+l+" - "+nomesLinhas[l]+" disponível"
}
else if(status < 0.85){
texto = "🟡 Linha "+l+" - "+nomesLinhas[l]+" com atraso"
}
else{
texto = "🔴 Linha "+l+" - "+nomesLinhas[l]+" com problema"
}

document.getElementById("status").innerHTML += texto+"<br>"

if(rotasCuritiba[l] && !linhaValida){
linhaValida = l
}

})

if(linhaValida){
desenharLinha(linhaValida)
}

}



function desenharLinha(linha){

rotaAtual.forEach(l=>map.removeLayer(l))
rotaAtual = []

if(onibus) map.removeLayer(onibus)

clearInterval(movimento)

let pontos = rotasCuritiba[linha]

if(!pontos) return

let poly = L.polyline(pontos,{
color:"blue",
weight:5
}).addTo(map)

rotaAtual.push(poly)

map.fitBounds(poly.getBounds())

onibus = L.marker(pontos[0]).addTo(map)

let i = 0

movimento = setInterval(()=>{

if(i < pontos.length){

onibus.setLatLng(pontos[i])

i++

}
else{
i = 0
}

},5000)

}


// localização do usuário
if(navigator.geolocation){

navigator.geolocation.getCurrentPosition(pos=>{

let lat = pos.coords.latitude
let lon = pos.coords.longitude

L.marker([lat,lon]).addTo(map)
.bindPopup("Você está aqui")
.openPopup()

})

}