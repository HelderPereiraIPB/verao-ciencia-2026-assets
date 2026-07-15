var ESCALA = 7; // personalizavel -- tenta 3 ou 15

// no TOPO do ficheiro, ANTES de "var createScene = ...":
var PASTA_MODELOS =
"https://raw.githubusercontent.com/HelderPereiraIPB/" +
"verao-ciencia-2026-assets/main/GLB/";
  async function carregarModelo(nome, ficheiro, x, y, z, scene, pai, escalaExtra) {
    // ESTAS DUAS LINHAS:
    var basePath = ficheiro.startsWith("./") ? "" : PASTA_MODELOS;
    var res = await BABYLON.SceneLoader.ImportMeshAsync("", basePath, ficheiro, scene);
    
    // ... (o resto da função)
var raiz = res.meshes[0];
raiz.name = nome; // recentra o modelo e poe a base dele em y=0
var bb = raiz.getHierarchyBoundingVectors();
var centroX = (bb.min.x + bb.max.x) / 2;
var centroZ = (bb.min.z + bb.max.z) / 2;
var baseY = bb.min.y;
raiz.position.x -= centroX;
raiz.position.z -= centroZ;
raiz.position.y -= baseY;
var escalaFinal = ESCALA * (escalaExtra || 1);
raiz.scaling.x *= escalaFinal;
raiz.scaling.y *= escalaFinal;
raiz.scaling.z *= escalaFinal;
raiz.position.x = raiz.position.x * ESCALA + x;
raiz.position.y = raiz.position.y * ESCALA + y;
raiz.position.z = raiz.position.z * ESCALA + z;
if (pai) raiz.setParent(pai);
return { raiz: raiz, animationGroups: res.animationGroups };
}



// no TOPO do ficheiro, ANTES de "var createScene = ...": se dois
// obstaculos usarem o mesmo ficheiro (ex: os dois barris), para que
// descarregar o mesmo .glb da internet duas vezes? guarda-se o
// primeiro numa "cache" e clona-se nas vezes seguintes
var cacheModelos = {};
async function carregarModeloRapido(nome, ficheiro, x, y, z, scene, pai) {
if (!cacheModelos[ficheiro]) {
var base = (await carregarModeloRapido("base", ficheiro, 0, 0, 0, scene)).raiz;
base.setEnabled(false); // e so um molde, nunca aparece sozinho
cacheModelos[ficheiro] = base;
}
var raiz = cacheModelos[ficheiro].clone(nome, null);
raiz.setEnabled(true);
raiz.position.set(x, y, z);
if (pai) raiz.setParent(pai);
return raiz;
}



// no TOPO do ficheiro, ANTES de "var createScene = ...": uma textura
// nao precisa de vir de uma imagem -- pode ser desenhada num canvas,
// por codigo (aqui: um gradiente vertical simples)
function criarTexturaGradiente(scene, corTopo, corBase) {
var tex = new BABYLON.DynamicTexture(
"grad", { width: 4, height: 256 }, scene, false
);
var ctx = tex.getContext();
var grad = ctx.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0, corTopo);
grad.addColorStop(1, corBase);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 4, 256);
tex.update();
return tex;
}



var createScene = async function () {
var scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.55, 0.8, 0.95, 1); // cor do ceu
scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR; // nevoeiro = profundidade
scene.fogColor = new BABYLON.Color3(0.75, 0.88, 0.96);
scene.fogStart = 18; scene.fogEnd = 65;
var camera = new BABYLON.ArcRotateCamera(
"cam", -Math.PI / 2, Math.PI / 2.15, 13, new BABYLON.Vector3(4, 1.8, 0), scene
);
var light = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);


var PASTA_TEXTURAS =
"https://raw.githubusercontent.com/HelderPereiraIPB/" +
"verao-ciencia-2026-assets/main/Texturas/";
var hdrCeu = new BABYLON.HDRCubeTexture(
// ceu real de 360 graus (polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)
PASTA_TEXTURAS + "ceu_polyhaven.hdr", scene, 256
);
scene.createDefaultSkybox(hdrCeu, false, 1000); // cria e coloca o ceu sozinho


light.intensity = 0.9;
var ceu = BABYLON.MeshBuilder.CreatePlane("ceu", { width: 300, height: 60 }, scene);
ceu.position.set(0, 15, 20);
var ceuMat = new BABYLON.StandardMaterial("ceuMat", scene); // ganha textura no bloco 10
//ceuMat.emissiveColor = new BABYLON.Color3(0.4, 0.7, 0.95);
ceuMat.emissiveTexture = criarTexturaGradiente(scene, "#4f95d6", "#cfe9f8");
ceuMat.disableLighting = true; ceuMat.fogEnabled = false; ceu.material = ceuMat;
var chao = BABYLON.MeshBuilder.CreateGround( // no bloco 10 ganha textura
"chao", { width: 300, height: 50 }, scene
);


//var chaoMat = new BABYLON.StandardMaterial("chaoMat", scene);
//chaoMat.diffuseColor = new BABYLON.Color3(0.55, 0.35, 0.2); // tenta (0,1,0)
//chaoMat.diffuseColor = new BABYLON.Color3(0.1, 0.35, 0.1); // chao verde escuro



var chaoMat = new BABYLON.PBRMaterial("chaoMat", scene); // agora e PBR
var PASTA_TEXTURAS =
"https://raw.githubusercontent.com/HelderPereiraIPB/" +
"verao-ciencia-2026-assets/main/Texturas/";
var texCor = new BABYLON.Texture(PASTA_TEXTURAS + "relva_cor.jpg", scene);
texCor.uScale = 6; texCor.vScale = 6; // repete a imagem 6x6 vezes pelo chao
chaoMat.albedoTexture = texCor; // a cor/imagem em si (ambientcg.com/view?id=Grass004)
var texNormal = new BABYLON.Texture(PASTA_TEXTURAS + "relva_normal.jpg", scene);
texNormal.uScale = 6; texNormal.vScale = 6;
chaoMat.bumpTexture = texNormal; // da relevo (sombras), sem mexer na geometria
var texRugosidade = new BABYLON.Texture(PASTA_TEXTURAS + "relva_rugosidade.jpg", scene);
texRugosidade.uScale = 6; texRugosidade.vScale = 6;
chaoMat.metallicTexture = texRugosidade; // rugosidade real (ambientCG)
chaoMat.useRoughnessFromMetallicTextureGreen = true; // le a rugosidade desta imagem
chaoMat.metallic = 0; // a relva nao e meta

chao.material = chaoMat;


// dentro do createScene, logo a seguir a "chao.material = chaoMat;"
// -- ANTES do "return scene;" que ja existe no fim do ficheiro
// (nao o dupliques, so fica lá uma vez):
var mallardObj = await carregarModelo(
"Mallard", "Mallard_Low_Poly.glb", 0, 0, 0, scene
);
var mallard = mallardObj.raiz;
mallard.rotationQuaternion = null; // permite rodar pelo eixo Y
mallard.rotation.y = -Math.PI / 2; // vira para a direita

// dentro do createScene, depois de carregar o Mallard:
var nivel = new BABYLON.TransformNode("nivel", scene);
var VELOCIDADE_ANDAR = 10; // tenta 15, o Mallard fica bem mais rapido
var teclas = {};
window.addEventListener("keydown", function (e) {
teclas[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", function (e) {
teclas[e.key.toLowerCase()] = false;
});
var estado = { aFacingDireita: true };
// a seguir a "var estado = {...}" do bloco 3:
var VELOCIDADE_SALTO = 12; // tenta 20, um salto bem mais alto
var GRAVIDADE = -22; // tenta -10, saltos mais lentos e flutuantes
estado.velocidadeY = 0;
estado.noChao = true;

var walkAnim = mallardObj.animationGroups.find(a => a.name === "Walk");


// este ciclo corre uma vez por cada frame desenhado -- cola-o dentro
// do createScene, ANTES do "return scene;" que ja existe (nao o
// dupliques, so fica lá uma vez, no fim do ficheiro):
scene.onBeforeRenderObservable.add(function () {
// limite de seguranca: um salto grande no tempo (ex: logo a seguir
// ao carregamento) nao deve mexer o jogo de repente
var dt = Math.min(engine.getDeltaTime() / 1000, 0.1);

// logo no inicio do onBeforeRenderObservable, a seguir ao "var dt = ...":
if (estado.fimDeJogo) return;
estado.tempoRestante -= dt;
if (estado.tempoRestante <= 0) {
estado.tempoRestante = 0;
estado.fimDeJogo = true;
textoFim.text = "Tempo esgotado! Pontos: " + estado.pontos;
if (walkAnim && walkAnim.isPlaying) walkAnim.stop(); // para o Mallard de "andar" parado
}
textoTempo.text = "Tempo: " + Math.ceil(estado.tempoRestante);
textoPontos.text = "Pontos: " + estado.pontos;

var andou = false;

// as colisoes prontas do Babylon assumem um boneco a andar num cenario
// parado -- aqui e o cenario que desliza, por isso comparamos posicoes
// a nossa maneira. Dentro do onBeforeRenderObservable, antes do "if (teclas[d]...)":
var bloqueadoAAvancar = plataformas.some(function (p) {
var dx = Math.abs(nivel.position.x + p.x);
return dx < p.raioBloqueio && mallard.position.y < p.altura - MARGEM_BLOQUEIO;
});

// antes de mexer no velocidadeY:
var suporteY = 0;
plataformas.forEach(function (p) {
var dx = Math.abs(nivel.position.x + p.x);
var temAltura = mallard.position.y >= p.altura - MARGEM_BLOQUEIO;
if (dx < p.raioBloqueio && p.altura > suporteY && temAltura) suporteY = p.altura;
});
// a verificacao de aterrar troca o "0" por "suporteY":
if (estado.velocidadeY <= 0 && mallard.position.y <= suporteY) {
mallard.position.y = suporteY;
estado.velocidadeY = 0;
estado.noChao = true;
}

if (teclas["d"] || teclas["arrowright"] && !bloqueadoAAvancar) {
nivel.position.x -= VELOCIDADE_ANDAR * dt;
estado.aFacingDireita = true;
andou = true;
}
if (teclas["a"] || teclas["arrowleft"]) {
nivel.position.x += VELOCIDADE_ANDAR * dt;
estado.aFacingDireita = false;
andou = true;
}
mallard.rotation.y = estado.aFacingDireita ? -Math.PI / 2 : Math.PI / 2;
if (andou && walkAnim && !walkAnim.isPlaying) walkAnim.start(true);
if (!andou && walkAnim && walkAnim.isPlaying) walkAnim.stop();

// dentro do onBeforeRenderObservable, antes do "});" final:
if ((teclas[" "] || teclas["w"] || teclas["arrowup"]) && estado.noChao) {
estado.velocidadeY = VELOCIDADE_SALTO;
estado.noChao = false;
}
estado.velocidadeY += GRAVIDADE * dt;
mallard.position.y += estado.velocidadeY * dt;
if (estado.velocidadeY <= 0 && mallard.position.y <= 0) {
mallard.position.y = 0;
estado.velocidadeY = 0;
estado.noChao = true;
}

var degrauMat = new BABYLON.StandardMaterial("degrauMat", scene);
degrauMat.diffuseColor = new BABYLON.Color3(0.7, 0.6, 0.3); // tenta (0.8,0.8,0.8)
degraus.forEach(function (d) {
var degrau = BABYLON.MeshBuilder.CreateBox("degrau", {
width: LARGURA_DEGRAU, height: d.altura, depth: PROFUNDIDADE_DEGRAU
}, scene);
degrau.position.set(d.x, d.altura / 2, 0);
degrau.material = degrauMat; degrau.parent = nivel;
plataformas.push({ x: d.x, altura: d.altura, raioBloqueio: LARGURA_MALLARD / 2 + LARGURA_DEGRAU / 2 })
;
});

// dentro do onBeforeRenderObservable, antes do "});" final:
objetosPontuaveis.forEach(function (item) { if (item.apanhado) return;
var dx = Math.abs(nivel.position.x + item.x);
var passouPorCima = mallard.position.y > ALTURA_LIMPAR_PERIGO;
if (dx < RAIO_TOQUE && !passouPorCima) { item.apanhado = true;
estado.pontos += item.pontos; // soma ou subtrai, conforme o sinal
item.raiz.dispose();
}
});

// dentro do onBeforeRenderObservable, antes do "});" final:
if (!meta.isDisposed()) {
var dxMeta = Math.abs(nivel.position.x + COMPRIMENTO_NIVEL);
if (dxMeta < RAIO_TOQUE_META) {
estado.fimDeJogo = true;
estado.pontos += Math.floor(estado.tempoRestante) * BONUS_POR_SEGUNDO;
textoFim.text = "Chegaste! Pontos finais: " + estado.pontos;
textoPontos.text = "Pontos: " + estado.pontos; // atualiza o canto tambem, com o bonus incluido
if (walkAnim && walkAnim.isPlaying) walkAnim.stop();

BABYLON.Animation.CreateAndStartAnimation(
"panCamaraFim", camera, "target.x", 30, 20,
camera.target.x, camera.target.x - 5,
BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, new BABYLON.CubicEase()
);

}
}

});


// ainda na parte de configuracao do createScene (NAO dentro do
// onBeforeRenderObservable) -- a seguir ao bloco 8, mas ANTES do
// array obstaculosFixos do bloco 5:
var ALTURA_MAXIMA_SALTO =
(VELOCIDADE_SALTO * VELOCIDADE_SALTO) / (2 * Math.abs(GRAVIDADE));
var ALTURA_MAXIMA_SALTO_SEGURA = ALTURA_MAXIMA_SALTO * 0.8;
var ESPACAMENTO_DEGRAUS = 2.5;
var LARGURA_DEGRAU = 2;
var PROFUNDIDADE_DEGRAU = 3;
var degraus = [];
// calcula os degraus que faltam para um obstaculo desta altura ser
// saltavel aos poucos
function gerarDegrausAutomaticos(xObstaculo, alturaObstaculo) {
var lista = [];
if (alturaObstaculo - MARGEM_BLOQUEIO <= ALTURA_MAXIMA_SALTO_SEGURA) return lista;
var numDegraus =
Math.ceil(alturaObstaculo / ALTURA_MAXIMA_SALTO_SEGURA) - 1;
for (var k = 1; k <= numDegraus; k++) {
lista.push({
x: xObstaculo - ESPACAMENTO_DEGRAUS * (numDegraus - k + 1),
altura: (alturaObstaculo * k) / (numDegraus + 1),
});
}
return lista;
}


// a seguir ao bloco 4, ainda dentro do createScene:
var LARGURA_MALLARD = 1.1;
var MARGEM_BLOQUEIO = 1.2; // tolerancia -- nao exige saltar a altura toda
var obstaculosFixos = [
{ ficheiro: "./modelos/gothic_statue.glb", x: 9, y: 0, escala: 0.4 },
{ ficheiro: "Pilar_Low_Poly.glb", x: 24, y: 0 },
{ ficheiro: "Barrel.glb", x: 54, y: 0 },
{ ficheiro: "Barrel.glb", x: 70, y: 0 },
{ ficheiro: "Barrel.glb", x: 90, y: 0 },
]; // tenta mudar os "x" ou trocar o ficheiro
var plataformas = [];
for (var i = 0; i < obstaculosFixos.length; i++) {
var of = obstaculosFixos[i];
var objFixo = await carregarModelo(
"obstaculo" + i, of.ficheiro, of.x, of.y, 0, scene, nivel, of.escala
);
var bbFixo = objFixo.raiz.getHierarchyBoundingVectors();
var alturaFixo = bbFixo.max.y - of.y;
plataformas.push({
x: of.x, altura: alturaFixo, raioBloqueio: LARGURA_MALLARD / 2 + (bbFixo.max.x - bbFixo.min.x) / 2,
});
degraus = degraus.concat(gerarDegrausAutomaticos(of.x, alturaFixo));
}

// a seguir ao bloco 5, ainda dentro do createScene, ANTES do
// "return scene;" que ja existe:
var RAIO_TOQUE = 1.1;
var ALTURA_LIMPAR_PERIGO = 1.5; estado.pontos = 0; // saltar alto = passa ao lado
var pontuaveis = [ // pontos negativo = tira pontos! tenta pontos: -20 na galinha
{ ficheiro: "Presunto_Low_Poly.glb", x: 16, y: 1, pontos: 10 },
{ ficheiro: "Basketballv2.glb", x: 32, y: 1, pontos: 5 },
{ ficheiro: "Basketballv2.glb", x: 46, y: 1, pontos: 5 },
{ ficheiro: "Presunto_Low_Poly.glb", x: 64, y: 1, pontos: 10 },
{ ficheiro: "Sprite_Crossy_Road.glb", x: 39, y: 0, pontos: -5 },
{ ficheiro: "Presunto_Low_Poly.glb", x: 76, y: 1, pontos: 10 },
];
var objetosPontuaveis = [];
for (var j = 0; j < pontuaveis.length; j++) { var pv = pontuaveis[j];
var raizPv = (await carregarModelo("pontuavel" + j, pv.ficheiro, pv.x, pv.y, 0, scene, nivel, pv.escala)).raiz;
objetosPontuaveis.push({ raiz: raizPv, x: pv.x, pontos: pv.pontos, apanhado: false });
}


// a seguir ao bloco 6, ainda dentro do createScene, ANTES do
// "return scene;" que ja existe:
var TEMPO_JOGO_SEGUNDOS = 30; // tenta 20, um jogo bem mais apertado
estado.tempoRestante = TEMPO_JOGO_SEGUNDOS;
estado.fimDeJogo = false;
var gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("gui");
var textoPontos = new BABYLON.GUI.TextBlock();
textoPontos.text = "Pontos: 0"; textoPontos.color = "white";
// resizeToFit ajusta a caixa ao texto -- sem isto ocupava o ecra todo
textoPontos.fontSize = 28; textoPontos.resizeToFit = true;
textoPontos.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
textoPontos.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
textoPontos.left = "20px";
textoPontos.top = "15px";
gui.addControl(textoPontos);
var textoTempo = new BABYLON.GUI.TextBlock();
textoTempo.text = "Tempo: " + TEMPO_JOGO_SEGUNDOS; textoTempo.color = "white";
textoTempo.fontSize = 28; textoTempo.resizeToFit = true;
textoTempo.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
textoTempo.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
textoTempo.left = "-20px";
textoTempo.top = "15px";
gui.addControl(textoTempo);

// a seguir a "gui.addControl(textoTempo);" do slide anterior, ainda
// dentro do createScene, ANTES do "return scene;" que ja existe:
var textoFim = new BABYLON.GUI.TextBlock();
textoFim.text = "";
textoFim.color = "white";
textoFim.fontSize = 32;
textoFim.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
textoFim.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
textoFim.top = "60px";
textoFim.textWrapping = true;
textoFim.width = "80%";
textoFim.height = "80px";
gui.addControl(textoFim);


// a seguir ao bloco 7, ainda dentro do createScene, ANTES do
// "return scene;" que ja existe (nao o dupliques):
var RAIO_TOQUE_META = 8; // distancia a que a bandeira conta "alcancada"
var BONUS_POR_SEGUNDO = 2; // tenta 0, so os pontos apanhados contam
var MARGEM_META = 20;
// a bandeira coloca-se sozinha a seguir ao ultimo objeto -- nunca fica
// impossivel so por a meta ficar demasiado perto
var COMPRIMENTO_NIVEL = Math.max(
0,
...obstaculosFixos.map(function (o) { return o.x; }),
...pontuaveis.map(function (p) { return p.x; }),
...degraus.map(function (d) { return d.x; })
) + MARGEM_META;

var meta = BABYLON.MeshBuilder.CreateBox(
"meta", { width: 0.5, height: 4, depth: 0.5 }, scene
);
meta.position.set(COMPRIMENTO_NIVEL, 2, 0);
meta.parent = nivel;
var metaMat = new BABYLON.StandardMaterial("metaMat", scene);
//metaMat.diffuseColor = new BABYLON.Color3(1, 1, 0); // tenta (1,0,1)
metaMat.diffuseColor = new BABYLON.Color3(1, 0, 1); // bandeira roxa
meta.material = metaMat;

return scene;
};
export default createScene;