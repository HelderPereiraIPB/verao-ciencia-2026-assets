var ESCALA = 7;
var PASTA_MODELOS = "https://raw.githubusercontent.com/HelderPereiraIPB/verao-ciencia-2026-assets/main/GLB/";

async function carregarModelo(nome, ficheiro, x, y, z, scene, pai) {
  var res = await BABYLON.SceneLoader.ImportMeshAsync("", PASTA_MODELOS, ficheiro, scene);
  var raiz = res.meshes[0];
  raiz.name = nome;

  var bb = raiz.getHierarchyBoundingVectors();
  var centroX = (bb.min.x + bb.max.x) / 2;
  var centroZ = (bb.min.z + bb.max.z) / 2;
  var baseY = bb.min.y;

  raiz.position.x -= centroX;
  raiz.position.z -= centroZ;
  raiz.position.y -= baseY;

  raiz.scaling.x *= ESCALA;
  raiz.scaling.y *= ESCALA;
  raiz.scaling.z *= ESCALA;

  raiz.position.x = raiz.position.x * ESCALA + x;
  raiz.position.y = raiz.position.y * ESCALA + y;
  raiz.position.z = raiz.position.z * ESCALA + z;

  if (pai) raiz.setParent(pai);

  return { raiz: raiz, animationGroups: res.animationGroups };
}

// cache dos modelos estaticos (sem animacao) ja carregados, por nome de
// ficheiro -- para objetos repetidos (ex: dois barris) nao se voltar a
// descarregar o mesmo .glb da internet varias vezes
var cacheModelosEstaticos = {};

// carrega um GLB e coloca-o na cena -- se o mesmo ficheiro ja tiver sido
// usado antes, clona a copia guardada em vez de o descarregar outra vez.
// so para objetos sem animacao (o Mallard usa "carregarModelo" acima)
async function carregarModeloEstatico(nome, ficheiro, x, y, z, scene, pai) {
  if (!cacheModelosEstaticos[ficheiro]) {
    var res = await BABYLON.SceneLoader.ImportMeshAsync("", PASTA_MODELOS, ficheiro, scene);
    var raizBase = res.meshes[0];

    var bb = raizBase.getHierarchyBoundingVectors();
    var centroX = (bb.min.x + bb.max.x) / 2;
    var centroZ = (bb.min.z + bb.max.z) / 2;
    var baseY = bb.min.y;

    raizBase.position.x -= centroX;
    raizBase.position.z -= centroZ;
    raizBase.position.y -= baseY;

    raizBase.scaling.x *= ESCALA;
    raizBase.scaling.y *= ESCALA;
    raizBase.scaling.z *= ESCALA;
    raizBase.position.scaleInPlace(ESCALA);

    raizBase.setEnabled(false); // e so um molde para clonar, nunca aparece sozinho
    cacheModelosEstaticos[ficheiro] = raizBase;
  }

  var raiz = cacheModelosEstaticos[ficheiro].clone(nome, null);
  raiz.setEnabled(true);
  raiz.position.x += x;
  raiz.position.y += y;
  raiz.position.z += z;
  if (pai) raiz.setParent(pai);
  return raiz;
}

// gera uma textura com um gradiente vertical (ex: ceu, mais escuro em
// cima e mais claro perto do horizonte) -- desenhada num canvas, sem
// precisar de nenhuma imagem externa
function criarTexturaGradiente(scene, nome, corTopo, corBase) {
  var tex = new BABYLON.DynamicTexture(nome, { width: 4, height: 256 }, scene, false);
  var ctx = tex.getContext();
  var grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, corTopo);
  grad.addColorStop(1, corBase);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  tex.update();
  return tex;
}

// textura das "colinas" -- em vez de um retangulo verde solido (que
// parece um muro), desenha uma silhueta ondulada com varias colinas
// sobrepostas, com a parte de cima transparente para deixar ver o ceu
function criarTexturaMontes(scene) {
  var w = 512, h = 128;
  var tex = new BABYLON.DynamicTexture("montesTex", { width: w, height: h }, scene, false);
  var ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#8fbf6a");
  grad.addColorStop(1, "#3f7a3f");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.5);
  for (var x = 0; x <= w; x += 8) {
    var y = h * 0.5 + Math.sin(x * 0.018) * h * 0.14 + Math.sin(x * 0.05 + 2) * h * 0.06;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

// textura do chao -- manchas de tom variavel espalhadas sobre a cor
// base de terra, para dar textura em vez de uma cor solida lisa
function criarTexturaChao(scene) {
  var w = 256, h = 256;
  var tex = new BABYLON.DynamicTexture("chaoTex", { width: w, height: h }, scene, false);
  var ctx = tex.getContext();
  ctx.fillStyle = "#8a5a33";
  ctx.fillRect(0, 0, w, h);
  for (var i = 0; i < 900; i++) {
    var x = Math.random() * w;
    var y = Math.random() * h;
    var r = 1 + Math.random() * 2.5;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(60,38,20,0.35)" : "rgba(160,115,70,0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update();
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.uScale = 40;
  tex.vScale = 6;
  return tex;
}

var createScene = async function () {
  // reinicia a cache sempre que uma cena nova comeca
  cacheModelosEstaticos = {};

  var scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.55, 0.8, 0.95, 1);

  // nevoeiro suave, da cor do ceu -- funde o chao e os objetos mais
  // distantes no fundo em vez de terminarem de repente, dando sensacao
  // de profundidade sem precisar de mais geometria
  scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogColor = new BABYLON.Color3(0.75, 0.88, 0.96);
  scene.fogStart = 18;
  scene.fogEnd = 65;

  // alvo da camara desviado para a direita -- o Mallard fica encostado
  // a esquerda do ecra, com mais espaco visivel a frente dele
  var camera = new BABYLON.ArcRotateCamera(
    "cam", -Math.PI / 2, Math.PI / 2.15, 13, new BABYLON.Vector3(4, 1.8, 0), scene
  );
  var light = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

  var ceu = BABYLON.MeshBuilder.CreatePlane("ceu", { width: 300, height: 60 }, scene);
  ceu.position.set(0, 15, 20);
  var ceuMat = new BABYLON.StandardMaterial("ceuMat", scene);
  // textura emissiva -- aparece sempre com a sua propria cor, sem depender da luz da cena
  ceuMat.emissiveTexture = criarTexturaGradiente(scene, "ceuTex", "#4f95d6", "#cfe9f8");
  ceuMat.disableLighting = true;
  // o ceu e as colinas sao um pano de fundo pintado -- nao um objeto
  // real a esta distancia -- por isso ficam de fora do nevoeiro, senao
  // o nevoeiro lava-lhes a cor toda e ficam cinzentos em vez de azul/verde
  ceuMat.fogEnabled = false;
  ceu.material = ceuMat;

  var montes = BABYLON.MeshBuilder.CreatePlane("montes", { width: 300, height: 12 }, scene);
  montes.position.set(0, 3, 11);
  var montesMat = new BABYLON.StandardMaterial("montesMat", scene);
  var texMontes = criarTexturaMontes(scene);
  texMontes.hasAlpha = true;
  montesMat.diffuseTexture = texMontes; // so para dar o canal alfa (transparencia)
  montesMat.emissiveTexture = texMontes; // esta e que da a cor visivel
  montesMat.useAlphaFromDiffuseTexture = true;
  montesMat.disableLighting = true;
  montesMat.fogEnabled = false;
  montesMat.backFaceCulling = false;
  montes.material = montesMat;

  // chao bem mais largo do que aquilo que a camara alcanca a ver
  var chao = BABYLON.MeshBuilder.CreateGround("chao", { width: 300, height: 50 }, scene);
  var chaoMat = new BABYLON.StandardMaterial("chaoMat", scene);
  chaoMat.diffuseTexture = criarTexturaChao(scene);
  chao.material = chaoMat;

  var nivel = new BABYLON.TransformNode("nivel", scene);

  // estas constantes de fisica tem de ficar definidas antes dos
  // obstaculos serem carregados, porque servem para calcular quantos
  // degraus automaticos cada um precisa (mais abaixo)
  var VELOCIDADE_ANDAR = 6;
  var VELOCIDADE_SALTO = 12;
  var GRAVIDADE = -22;
  var ALTURA_NORMAL = 1;
  var ALTURA_AGACHADO = 0.5;
  var RAIO_TOQUE = 1.1;
  // distancia a que a bandeira final passa a contar como "alcancada"
  var RAIO_TOQUE_META = 8; // tenta mudar este numero
  // ao chegar a meta, desloca a camara para o Mallard sair da sua posicao fixa habitual
  var DESVIO_CAMARA_FIM = 5;
  // altura minima para "limpar" um perigo (a Galinha) sem lhe tocar --
  // um pouco abaixo da altura real dela, para dar alguma margem
  var ALTURA_LIMPAR_PERIGO = 1.5;
  // margem de tolerancia ao bloquear um obstaculo fixo -- nao exige
  // limpar a altura toda, senao um salto quase perfeito conta como falha
  var MARGEM_BLOQUEIO = 1.2;

  // mantem o salto proporcional ao tamanho do mundo quando ESCALA muda
  var FATOR_ESCALA = ESCALA / 10;
  var VELOCIDADE_SALTO_EFETIVA = VELOCIDADE_SALTO * Math.sqrt(FATOR_ESCALA);

  // altura maxima que um salto alcanca, com margem de seguranca -- usada
  // para gerar automaticamente os degraus que faltam a um obstaculo alto,
  // para um nivel nunca poder ficar impossivel de completar
  var ALTURA_MAXIMA_SALTO = (VELOCIDADE_SALTO * VELOCIDADE_SALTO) / (2 * Math.abs(GRAVIDADE));
  var ALTURA_MAXIMA_SALTO_SEGURA = ALTURA_MAXIMA_SALTO * 0.8 * FATOR_ESCALA;
  var ESPACAMENTO_DEGRAUS = 2.5;
  var LARGURA_DEGRAU = 2 * FATOR_ESCALA;
  var PROFUNDIDADE_DEGRAU = 3 * FATOR_ESCALA;

  // calcula os degraus automaticos que faltam para um obstaculo desta
  // altura ser saltavel aos poucos -- funciona com qualquer glb
  // (incluindo modelos novos trazidos pelos alunos), porque usa a altura
  // real medida do modelo, nao um valor escrito a mao
  function gerarDegrausAutomaticos(xObstaculo, alturaObstaculo) {
    var lista = [];
    // so cria degraus se o obstaculo for mesmo alto demais para um unico salto
    if (alturaObstaculo - MARGEM_BLOQUEIO <= ALTURA_MAXIMA_SALTO_SEGURA) return lista;
    var numDegraus = Math.ceil(alturaObstaculo / ALTURA_MAXIMA_SALTO_SEGURA) - 1;
    for (var k = 1; k <= numDegraus; k++) {
      lista.push({
        x: xObstaculo - ESPACAMENTO_DEGRAUS * (numDegraus - k + 1),
        altura: (alturaObstaculo * k) / (numDegraus + 1),
      });
    }
    return lista;
  }

  // obstaculos fixos: nao dao nem tiram pontos, nao desaparecem --
  // sao paredes a serio, o Mallard tem de saltar por cima (ou usar as
  // escadas, no caso do Pilar, que e demasiado alto para um salto so)
  var obstaculosFixos = [
    { ficheiro: "Pilar_Low_Poly.glb", x: 9, y: 0 },
    { ficheiro: "Barrel.glb", x: 24, y: 0 },
    { ficheiro: "Barrel.glb", x: 54, y: 0 },
  ];

  // pontuaveis: um unico array para tudo o que da (ou tira) pontos ao
  // tocar -- pontos positivo soma, negativo subtrai, e ambos desaparecem
  // ao serem tocados. "y" e a altura a que ficam colocados (0 = no chao).
  var pontuaveis = [
    { ficheiro: "Presunto_Low_Poly.glb", x: 16, y: 1, pontos: 10 },
    { ficheiro: "Basketballv2.glb", x: 32, y: 1, pontos: 5 },
    { ficheiro: "Basketballv2.glb", x: 46, y: 1, pontos: 5 },
    { ficheiro: "Presunto_Low_Poly.glb", x: 64, y: 1, pontos: 10 },
    { ficheiro: "Sprite_Crossy_Road.glb", x: 39, y: 0, pontos: -5 },
  ];

  // degraus manuais, extra -- para alem dos automaticos (mais abaixo),
  // podes colocar aqui obstaculos simples sem glb nenhum, com a altura
  // que quiseres, tanto sozinhos como junto a um obstaculo existente
  var degraus = [];

  // margem depois do ultimo objeto colocado, para sobrar sempre espaco
  // de "corrida final" ate a bandeira, por muito que os arrays acima
  // mudem -- assim o nivel nunca fica impossivel so por se acrescentar
  // ou tirar objetos
  var MARGEM_META = 20;
  var COMPRIMENTO_NIVEL = Math.max(
    0,
    ...obstaculosFixos.map(function (o) { return o.x; }),
    ...pontuaveis.map(function (p) { return p.x; }),
    ...degraus.map(function (d) { return d.x; })
  ) + MARGEM_META;

  // "plataformas" junta tudo o que bloqueia o avanco e/ou se pode pisar
  // em cima (Pilar, Barris, degraus) -- verificacao simples por
  // distancia/altura, sem depender do motor de colisao do Babylon (que
  // nao foi feito para um mundo que desliza para dentro do jogador).
  // "raioBloqueio" usa a largura real de cada objeto (+ a largura do
  // Mallard) para o bloqueio parar mesmo a tempo, sem entrar visualmente
  // dentro do modelo.
  var LARGURA_MALLARD = 1.1;
  var plataformas = [];
  for (var i = 0; i < obstaculosFixos.length; i++) {
    var of = obstaculosFixos[i];
    var raizFixo = await carregarModeloEstatico("obstaculo" + i, of.ficheiro, of.x, of.y, 0, scene, nivel);
    var bbFixo = raizFixo.getHierarchyBoundingVectors();
    var alturaFixo = bbFixo.max.y - of.y;
    plataformas.push({
      x: of.x,
      altura: alturaFixo,
      raioBloqueio: LARGURA_MALLARD / 2 + (bbFixo.max.x - bbFixo.min.x) / 2,
    });
    // se este obstaculo for alto demais para saltar de uma vez so
    // (qualquer que seja o glb), gera os degraus que faltam sozinho
    degraus = degraus.concat(gerarDegrausAutomaticos(of.x, alturaFixo));
  }

  var objetosPontuaveis = [];
  for (var j = 0; j < pontuaveis.length; j++) {
    var pv = pontuaveis[j];
    var raizPv = await carregarModeloEstatico("pontuavel" + j, pv.ficheiro, pv.x, pv.y, 0, scene, nivel);
    objetosPontuaveis.push({ raiz: raizPv, x: pv.x, pontos: pv.pontos, apanhado: false });
  }

  var degrauMat = new BABYLON.StandardMaterial("degrauMat", scene);
  degrauMat.diffuseColor = new BABYLON.Color3(0.7, 0.6, 0.3);
  degraus.forEach(function (d) {
    var degrau = BABYLON.MeshBuilder.CreateBox(
      "degrau", { width: LARGURA_DEGRAU, height: d.altura, depth: PROFUNDIDADE_DEGRAU }, scene
    );
    degrau.position.set(d.x, d.altura / 2, 0);
    degrau.material = degrauMat;
    degrau.parent = nivel;
    plataformas.push({ x: d.x, altura: d.altura, raioBloqueio: LARGURA_MALLARD / 2 + LARGURA_DEGRAU / 2 });
  });

  var meta = BABYLON.MeshBuilder.CreateBox("meta", { width: 0.5, height: 4, depth: 0.5 }, scene);
  meta.position.set(COMPRIMENTO_NIVEL, 2, 0);
  meta.parent = nivel;
  var metaMat = new BABYLON.StandardMaterial("metaMat", scene);
  metaMat.diffuseColor = new BABYLON.Color3(1, 1, 0);
  meta.material = metaMat;

  var mallardObj = await carregarModelo("Mallard", "Mallard_Low_Poly.glb", 0, 0, 0, scene);
  var mallard = mallardObj.raiz;
  // o glb importa com rotationQuaternion definido, que ignora .rotation --
  // temos de o anular para conseguirmos rodar o Mallard para o perfil certo
  mallard.rotationQuaternion = null;
  mallard.rotation.y = -Math.PI / 2; // vira para a direita (posicao inicial)
  var walkAnim = mallardObj.animationGroups.find(a => a.name === "Walk");

  var TEMPO_JOGO_SEGUNDOS = 60;
  // pontos extra por cada segundo que sobrar quando se chega a meta --
  // recompensa ser rapido, nao so apanhar coisas
  var BONUS_POR_SEGUNDO = 2;

  var estado = {
    pontos: 0,
    tempoRestante: TEMPO_JOGO_SEGUNDOS,
    velocidadeY: 0,
    noChao: true,
    agachado: false,
    aFacingDireita: true,
    fimDeJogo: false,
    distanciaPercorrida: 0,
  };

  var teclas = {};
  window.addEventListener("keydown", function (e) { teclas[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", function (e) { teclas[e.key.toLowerCase()] = false; });

  var gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("gui");

  // sem resizeToFit, a caixa de um TextBlock ocupa o ecra todo por defeito
  // e o texto fica sempre centrado la dentro -- por isso a caixa tem de se
  // ajustar ao proprio texto para o alinhamento ao canto funcionar
  var textoPontos = new BABYLON.GUI.TextBlock();
  textoPontos.text = "Pontos: 0";
  textoPontos.color = "white";
  textoPontos.fontSize = 28;
  textoPontos.resizeToFit = true;
  textoPontos.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  textoPontos.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  textoPontos.left = "20px";
  textoPontos.top = "15px";
  gui.addControl(textoPontos);

  var textoTempo = new BABYLON.GUI.TextBlock();
  textoTempo.text = "Tempo: " + TEMPO_JOGO_SEGUNDOS;
  textoTempo.color = "white";
  textoTempo.fontSize = 28;
  textoTempo.resizeToFit = true;
  textoTempo.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  textoTempo.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  textoTempo.left = "-20px";
  textoTempo.top = "15px";
  gui.addControl(textoTempo);

  // linha propria no topo, por baixo de Pontos/Tempo, para nao sobrepor no fim do jogo
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

  // ignora a logica do jogo nos primeiros frames, para dar tempo a tudo assentar
  var framesPassados = 0;
  var FRAMES_AQUECIMENTO = 5;

  scene.onBeforeRenderObservable.add(function () {
    framesPassados++;
    if (framesPassados <= FRAMES_AQUECIMENTO) return;

    var dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    if (estado.fimDeJogo) return;

    estado.tempoRestante -= dt;
    if (estado.tempoRestante <= 0) {
      estado.tempoRestante = 0;
      estado.fimDeJogo = true;
      textoFim.text = "Tempo esgotado! Pontos: " + estado.pontos;
      if (walkAnim && walkAnim.isPlaying) walkAnim.stop();
    }
    textoTempo.text = "Tempo: " + Math.ceil(estado.tempoRestante);
    textoPontos.text = "Pontos: " + estado.pontos;

    // uma plataforma bloqueia o avanco enquanto o Mallard nao estiver
    // alto o suficiente para passar por cima dela
    var bloqueadoAAvancar = plataformas.some(function (p) {
      var dx = Math.abs(nivel.position.x + p.x);
      return dx < p.raioBloqueio && mallard.position.y < p.altura - MARGEM_BLOQUEIO;
    });

    var andou = false;
    if ((teclas["d"] || teclas["arrowright"]) && !bloqueadoAAvancar) {
      nivel.position.x -= VELOCIDADE_ANDAR * dt;
      estado.aFacingDireita = true;
      andou = true;
    }
    if (teclas["a"] || teclas["arrowleft"]) {
      nivel.position.x += VELOCIDADE_ANDAR * dt;
      estado.aFacingDireita = false;
      andou = true;
    }

    // rede de seguranca: empurra de volta para o limite exato de qualquer plataforma bloqueada
    plataformas.forEach(function (p) {
      var dx = nivel.position.x + p.x;
      if (Math.abs(dx) < p.raioBloqueio && mallard.position.y < p.altura - MARGEM_BLOQUEIO) {
        var sinal = dx >= 0 ? 1 : -1;
        nivel.position.x = sinal * p.raioBloqueio - p.x;
      }
    });
    estado.distanciaPercorrida = -nivel.position.x;
    mallard.rotation.y = estado.aFacingDireita ? -Math.PI / 2 : Math.PI / 2;

    if (andou && walkAnim && !walkAnim.isPlaying) walkAnim.start(true);
    if (!andou && walkAnim && walkAnim.isPlaying) walkAnim.stop();

    estado.agachado = !!(teclas["s"] || teclas["arrowdown"]);
    var alturaAlvo = estado.agachado ? ALTURA_AGACHADO : ALTURA_NORMAL;
    mallard.scaling.y = alturaAlvo * ESCALA;

    // suporte mais alto por baixo do Mallard neste momento (o chao conta sempre como o minimo)
    var suporteY = 0;
    plataformas.forEach(function (p) {
      var dx = Math.abs(nivel.position.x + p.x);
      var temAltura = mallard.position.y >= p.altura - MARGEM_BLOQUEIO;
      if (dx < p.raioBloqueio && p.altura > suporteY && temAltura) suporteY = p.altura;
    });

    if ((teclas[" "] || teclas["w"] || teclas["arrowup"]) && estado.noChao) {
      estado.velocidadeY = VELOCIDADE_SALTO_EFETIVA;
      estado.noChao = false;
    }
    estado.velocidadeY += GRAVIDADE * dt;
    mallard.position.y += estado.velocidadeY * dt;

    // so "aterra" quando esta a descer (nunca a meio de um salto a
    // subir) e chega ao nivel do suporte -- pousa exatamente nele,
    // sem afundar nem flutuar
    if (estado.velocidadeY <= 0 && mallard.position.y <= suporteY) {
      mallard.position.y = suporteY;
      estado.velocidadeY = 0;
      estado.noChao = true;
    } else if (mallard.position.y > suporteY) {
      estado.noChao = false;
    }

    // uma so regra para tudo o que da ou tira pontos: tocaste, ganhas
    // "item.pontos" (pode ser negativo, como a Galinha). Saltar alto
    // demais por cima (acima de ALTURA_LIMPAR_PERIGO) faz sempre passar
    // ao lado sem tocar -- serve tanto para evitar perder pontos como
    // para arriscar nao apanhar os que os dao
    objetosPontuaveis.forEach(function (item) {
      if (item.apanhado) return;
      var dx = Math.abs(nivel.position.x + item.x);
      var passouPorCima = mallard.position.y > ALTURA_LIMPAR_PERIGO;
      if (dx < RAIO_TOQUE && !passouPorCima) {
        item.apanhado = true;
        estado.pontos += item.pontos;
        item.raiz.dispose();
      }
    });

    if (!meta.isDisposed()) {
      var dxMeta = Math.abs(nivel.position.x + COMPRIMENTO_NIVEL);
      if (dxMeta < RAIO_TOQUE_META) {
        estado.fimDeJogo = true;
        // bonus por cada segundo que sobrou, so por chegar a meta (o
        // fim por tempo esgotado nunca tem segundos sobrando)
        estado.pontos += Math.floor(estado.tempoRestante) * BONUS_POR_SEGUNDO;
        textoFim.text = "Chegaste! Pontos finais: " + estado.pontos;
        // o "Pontos: X" do canto ja tinha sido escrito no inicio deste
        // frame, antes do bonus -- atualiza-o tambem, senao fica com um
        // valor diferente do "Pontos finais" mostrado ao lado
        textoPontos.text = "Pontos: " + estado.pontos;
        if (walkAnim && walkAnim.isPlaying) walkAnim.stop();
        // anima a camara em vez de a deslocar de repente
        BABYLON.Animation.CreateAndStartAnimation(
          "panCamaraFim", camera, "target.x", 30, 20,
          camera.target.x, camera.target.x - DESVIO_CAMARA_FIM,
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, new BABYLON.CubicEase()
        );
      }
    }
  });

  return scene;
};

export default createScene;
