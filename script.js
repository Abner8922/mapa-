// Inicializa o mapa centralizado
let map = L.map('map', {zoomControl: false}).setView([-25.43, -49.27], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

// Variáveis Globais
let terminalEscolhido = null;
let nomeTerminalEscolhido = ""; 
let pontosLinha = [];
let rotasAtuais = [];
let camadas = [];
let shapes = {};       
let linhasShapes = {}; 
let animacaoOnibus; 

let terminais = {
    "Terminal Guadalupe": [-25.4326, -49.2655],
    "Terminal Boqueirão": [-25.517, -49.230],
    "Terminal Cabral": [-25.406, -49.252],
    "Terminal Portão": [-25.478, -49.293],
    "Terminal Pinheirinho": [-25.538, -49.293],
    "Terminal Capão Raso": [-25.506, -49.291],
    "Terminal Carmo": [-25.501, -49.243] // Adicionado para seu teste
};

const baseLocais = [
    { nome: "Jardim Botânico", cidade: "Curitiba - PR", lat: -25.4428, lon: -49.2384 },
    { nome: "Museu Oscar Niemeyer (MON)", cidade: "Curitiba - PR", lat: -25.4104, lon: -49.2673 },
    { nome: "Parque Barigui", cidade: "Curitiba - PR", lat: -25.4244, lon: -49.3083 },
    { nome: "Ópera de Arame", cidade: "Curitiba - PR", lat: -25.3855, lon: -49.2761 },
    { nome: "Parque Tanguá", cidade: "Curitiba - PR", lat: -25.3785, lon: -49.2785 },
    { nome: "Bosque do Papa", cidade: "Curitiba - PR", lat: -25.4087, lon: -49.2690 },
    { nome: "Mercado Municipal", cidade: "Curitiba - PR", lat: -25.4344, lon: -49.2562 },
    { nome: "Praça Tiradentes", cidade: "Curitiba - PR", lat: -25.4284, lon: -49.2733 },
    { nome: "Passeio Público", cidade: "Curitiba - PR", lat: -25.4251, lon: -49.2662 },
    { nome: "Parque da Uva", cidade: "Colombo - PR", lat: -25.3033, lon: -49.2274 }
];

let localSelecionado = null; 

// ================= LÓGICA DO AUTOCOMPLETAR =================
function filtrarLocais() {
    let termo = document.getElementById("destino").value.toLowerCase();
    let divSugestoes = document.getElementById("sugestoes");
    divSugestoes.innerHTML = "";
    localSelecionado = null; 

    if (termo.length < 1) {
        divSugestoes.style.display = "none";
        return;
    }

    let filtrados = baseLocais.filter(l => l.nome.toLowerCase().includes(termo) || l.cidade.toLowerCase().includes(termo));

    if (filtrados.length > 0) {
        divSugestoes.style.display = "block";
        filtrados.forEach(l => {
            let item = document.createElement("div");
            item.className = "sugestao-item";
            item.innerHTML = `
                <div class="sugestao-icone">📍</div>
                <div class="sugestao-texto"><b>${l.nome}</b><small>${l.cidade}</small></div>
            `;
            item.onclick = () => {
                document.getElementById("destino").value = l.nome;
                divSugestoes.style.display = "none";
                localSelecionado = l; 
            };
            divSugestoes.appendChild(item);
        });
    } else {
        divSugestoes.style.display = "none";
    }
}

// ================= FETCH DE DADOS =================
fetch("2026_03_11_shapeLinha.json")
    .then(r => r.json())
    .then(data => {
        data.forEach(p => {
            let lat = parseFloat(p.LAT.replace(",", ".")); 
            let lon = parseFloat(p.LON.replace(",", "."));
            let shp = p.SHP;
            let cod = p.COD;
            if (!shapes[shp]) shapes[shp] = [];
            shapes[shp].push([lat, lon]);
            if (!linhasShapes[cod]) linhasShapes[cod] = new Set();
            linhasShapes[cod].add(shp);
        });
    })
    .catch(err => console.error("Erro ao carregar shapes:", err));

fetch("2026_03_16_pontosLinha.json")
    .then(r => r.json())
    .then(data => {
        data.forEach(p => {
            pontosLinha.push({
                linha: p.COD,
                lat: parseFloat(p.LAT.replace(",", ".")),
                lon: parseFloat(p.LON.replace(",", ".")),
                nome: p.NOME
            });
        });
    })
    .catch(err => console.error("Erro ao carregar pontos:", err));

// ================= INTERFACE INICIAL =================
function confirmarTerminal() {
    nomeTerminalEscolhido = document.getElementById("terminalSelect").value;
    terminalEscolhido = terminais[nomeTerminalEscolhido];

    L.marker(terminalEscolhido).bindPopup("Você está aqui").addTo(map).openPopup();
    map.setView(terminalEscolhido, 15);

    document.getElementById("popupTerminal").style.display = "none";
    document.getElementById("painelBusca").style.display = "block";
}

// ================= BUSCA DE DESTINO =================
function buscarRota() {
    let destino = document.getElementById("destino").value;
    if(!destino) return alert("Digite um destino!");

    document.getElementById("sugestoes").style.display = "none"; 

    if (localSelecionado) {
        L.marker([localSelecionado.lat, localSelecionado.lon]).bindPopup(localSelecionado.nome).addTo(map);
        calcularRota(terminalEscolhido[0], terminalEscolhido[1], localSelecionado.lat, localSelecionado.lon);
    } else {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${destino}, Curitiba`)
            .then(r => r.json())
            .then(data => {
                if(data.length === 0) return alert("Destino não encontrado!");
                let lat = parseFloat(data[0].lat);
                let lon = parseFloat(data[0].lon);
                L.marker([lat, lon]).bindPopup("Seu Destino").addTo(map);
                calcularRota(terminalEscolhido[0], terminalEscolhido[1], lat, lon);
            });
    }
}

// ================= LÓGICA DE ROTAS E BALDEAÇÃO =================
function pontosProximos(lat, lon) {
    return pontosLinha.filter(p => map.distance([lat, lon], [p.lat, p.lon]) < 500); 
}

function distancia(a, b) {
    return map.distance([a.lat, a.lon], [b.lat, b.lon]);
}

// NOVO: Agora retorna os dois pontos exatos para conectar as linhas!
function encontrarBaldeacao(l1, l2) {
    let p1 = pontosLinha.filter(p => p.linha == l1);
    let p2 = pontosLinha.filter(p => p.linha == l2);
    for (let a of p1) {
        for (let b of p2) {
            if (map.distance([a.lat, a.lon], [b.lat, b.lon]) < 200) {
                return { embarqueTroca: a, desembarqueTroca: b }; 
            }
        }
    }
    return null;
}

// O SEGREDO DO SUCESSO: Força o ônibus a ir pra frente e "cola" a linha nos pinos
function cortarTrecho(cod, inicio, fim) {
    let shpsDaLinha = Array.from(linhasShapes[cod] || []);
    let melhorTrecho = [];
    let menorDistanciaTotal = Infinity;

    for (let shp of shpsDaLinha) {
        let trajeto = shapes[shp];
        let idxInicio = -1, idxFim = -1;
        let distInicio = Infinity, distFim = Infinity;

        // Acha o ponto do trajeto mais próximo do INÍCIO
        trajeto.forEach((p, idx) => {
            let d1 = map.distance(p, [inicio.lat, inicio.lon]);
            if (d1 < distInicio) { distInicio = d1; idxInicio = idx; }
        });

        // Acha o ponto do FIM, SÓ DEPOIS do início (Garante sentido certo!)
        if (idxInicio !== -1) {
            for(let idx = idxInicio; idx < trajeto.length; idx++) {
                let p = trajeto[idx];
                let d2 = map.distance(p, [fim.lat, fim.lon]);
                if (d2 < distFim) { distFim = d2; idxFim = idx; }
            }
        }

        // Se achou uma rota lógica
        if (idxInicio !== -1 && idxFim !== -1 && idxInicio <= idxFim) {
            let distTotal = distInicio + distFim;
            if (distTotal < menorDistanciaTotal) {
                menorDistanciaTotal = distTotal;
                melhorTrecho = trajeto.slice(idxInicio, idxFim + 1);
            }
        }
    }

    if (melhorTrecho.length === 0 && shpsDaLinha.length > 0) return shapes[shpsDaLinha[0]]; 

    // Super Cola: Gruda exatamente no pino para não deixar "buracos" no mapa
    if(melhorTrecho.length > 0) {
        melhorTrecho.unshift([inicio.lat, inicio.lon]);
        melhorTrecho.push([fim.lat, fim.lon]);
    }

    return melhorTrecho;
}

function calcularRota(latO, lonO, latD, lonD) {
    let origem = pontosProximos(latO, lonO);
    let destino = pontosProximos(latD, lonD);
    let rotasPossiveis = [];

    origem.forEach(o => {
        destino.forEach(d => {
            if (o.linha == d.linha) {
                rotasPossiveis.push({ linhas: [o.linha], embarque: o, desembarque: d });
            } else {
                let troca = encontrarBaldeacao(o.linha, d.linha);
                if (troca) {
                    rotasPossiveis.push({ linhas: [o.linha, d.linha], embarque: o, baldeacao: troca, desembarque: d });
                }
            }
        });
    });

    let unicas = [];
    let set = new Set();
    rotasPossiveis.forEach(r => {
        let key = r.linhas.join("-") + r.embarque.nome + r.desembarque.nome;
        if (!set.has(key)) {
            set.add(key);
            unicas.push(r);
        }
    });

    unicas.forEach(r => {
        r.tempo = Math.round((distancia({lat:latO, lon:lonO}, r.embarque)/80) + (distancia(r.embarque, r.desembarque)/120) + (r.linhas.length*10));
    });

    unicas.sort((a, b) => a.tempo - b.tempo);
    rotasAtuais = unicas.slice(0, 3);
    mostrarRotas();
}

function gerarStatus() {
    let r = Math.random();
    if(r < 0.2) return { texto: "Com Defeito", classe: "defeito" };
    if(r < 0.5) return { texto: "Atrasado", classe: "atrasado" };
    return { texto: "Normal", classe: "normal" };
}

// ================= RENDERIZAR RESULTADOS =================
function mostrarRotas() {
    let html = "";
    if(rotasAtuais.length === 0) {
        html = `<div class="card"><p>Nenhuma rota encontrada para este destino num raio curto.</p></div>`;
        document.getElementById("info").innerHTML = html;
        return;
    }

    rotasAtuais.forEach((r, i) => {
        let st1 = gerarStatus();
        let st2 = r.linhas[1] ? gerarStatus() : null;

        html += `
        <div class="rota" onclick="selecionarRota(${i})">
            <div class="rota-titulo">📍 Opção ${i+1} (~${r.tempo} min)</div>
            <div class="linha-info">
                <span>🚌 <b>Linha ${r.linhas[0]}</b></span>
                <span class="badge ${st1.classe}">${st1.texto}</span>
            </div>
            ${r.linhas.length > 1 ? `
            <div class="linha-info">
                <span>🔁 <b>Trocar p/ Linha ${r.linhas[1]}</b></span>
                <span class="badge ${st2.classe}">${st2.texto}</span>
            </div>` : ""}
            <div class="local-info">Ponto Inicial: ${nomeTerminalEscolhido}</div>
        </div>`;
    });
    document.getElementById("info").innerHTML = html;
}

// ================= FUNÇÃO DA ANIMAÇÃO DO ÔNIBUS =================
function animarOnibus(caminho, corBorda) {
    if (!caminho || caminho.length === 0) return;
    if (animacaoOnibus) clearInterval(animacaoOnibus);

    document.documentElement.style.setProperty('--cor-borda-bus', corBorda);
    let icone = L.divIcon({ className: 'bus-animado', html: "🚌", iconSize: [35, 35], iconAnchor: [17, 17] });
    let markerOnibus = L.marker(caminho[0], {icon: icone}).addTo(map);
    camadas.push(markerOnibus);

    let i = 0;
    animacaoOnibus = setInterval(() => {
        if (i < caminho.length) {
            markerOnibus.setLatLng(caminho[i]);
            i++;
        } else {
            i = 0; 
        }
    }, 100); 
}

// ================= DESENHAR NO MAPA =================
function limparMapa() {
    camadas.forEach(c => map.removeLayer(c));
    camadas = [];
    if (animacaoOnibus) clearInterval(animacaoOnibus);
}

function selecionarRota(i) {
    limparMapa();
    let r = rotasAtuais[i];

    let c1 = L.polyline([[terminalEscolhido[0], terminalEscolhido[1]], [r.embarque.lat, r.embarque.lon]], {dashArray: "5,10", color: "#666", weight: 5}).addTo(map);
    camadas.push(c1);

    // Linha 1 atualizada
    let pontoFimLinha1 = r.baldeacao ? r.baldeacao.embarqueTroca : r.desembarque;
    let trecho1 = cortarTrecho(r.linhas[0], r.embarque, pontoFimLinha1);
    let l1 = L.polyline(trecho1, {color: "#0056b3", weight: 8, opacity: 0.9}).addTo(map);
    camadas.push(l1);
    
    animarOnibus(trecho1, "#0056b3");

    if (r.baldeacao) {
        let iconTroca = L.divIcon({className: 'custom-div-icon', html: "<div style='background:white; border-radius:50%; padding:5px; border:2px solid orange;'>🔁</div>", iconSize: [30, 30]});
        let m = L.marker([r.baldeacao.embarqueTroca.lat, r.baldeacao.embarqueTroca.lon], {icon: iconTroca}).addTo(map).bindPopup("Troque de ônibus aqui");
        camadas.push(m);

        // NOVO: Linha tracejada caso os pontos de baldeação não sejam exatamente no mesmo milímetro
        let cTroca = L.polyline([[r.baldeacao.embarqueTroca.lat, r.baldeacao.embarqueTroca.lon], [r.baldeacao.desembarqueTroca.lat, r.baldeacao.desembarqueTroca.lon]], {dashArray: "5,10", color: "#666", weight: 5}).addTo(map);
        camadas.push(cTroca);

        // Linha 2 atualizada
        let trecho2 = cortarTrecho(r.linhas[1], r.baldeacao.desembarqueTroca, r.desembarque);
        let l2 = L.polyline(trecho2, {color: "#ff8c00", weight: 8, opacity: 0.9}).addTo(map);
        camadas.push(l2);
    }

    let destinoFinal = rotasAtuais[0].desembarque; 
    if(localSelecionado) destinoFinal = localSelecionado; 
    let c2 = L.polyline([[r.desembarque.lat, r.desembarque.lon], [destinoFinal.lat, destinoFinal.lon]], {dashArray: "5,10", color: "#666", weight: 5}).addTo(map);
    camadas.push(c2);

    let grupo = L.featureGroup(camadas);
    map.fitBounds(grupo.getBounds(), {paddingTopLeft: [450, 50], paddingBottomRight: [50, 50]});
}