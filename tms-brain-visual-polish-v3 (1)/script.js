import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.getElementById("brain-container");
const viewerShell = document.getElementById("viewer-shell");
const loadingMessage = document.getElementById("loading-message");
const brainPiecePopup = document.getElementById("brain-piece-popup");
const brainPiecePopupTitle = document.getElementById("brain-piece-popup-title");
const brainPiecePopupText = document.getElementById("brain-piece-popup-text");
const brainPiecePopupLabel = document.getElementById("brain-piece-popup-label");
const brainPiecePopupLink = document.getElementById("brain-piece-popup-link");
const brainPiecePopupClose = document.getElementById("brain-piece-popup-close");
const brainPiecePopupDragHandle = document.getElementById("brain-piece-popup-drag-handle");

const dlpfcButton = document.getElementById("dlpfc-button");
const motorButton = document.getElementById("motor-button");
const sgaccButton = document.getElementById("sgacc-button");
const resetButton = document.getElementById("reset-button");

const separationSlider = document.getElementById("separation-slider");
const separationValue = document.getElementById("separation-value");
const separationHelp = document.getElementById("separation-help");

const panelCloseButton = document.getElementById("panel-close-button");
const panelOpenButton = document.getElementById("panel-open-button");

const sideViewButton = document.getElementById("side-view-button");
const topViewButton = document.getElementById("top-view-button");
const resetViewButton = document.getElementById("reset-view-button");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe1e3e6);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.01,
  1000
);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.8));

const mainLight = new THREE.DirectionalLight(0xffffff, 3);
mainLight.position.set(4, 6, 5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-4, 1, -4);
scene.add(fillLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.enablePan = true;
controls.enableRotate = true;

let brain = null;
let brainMaxDimension = 1;
let selectedRegion = null;

const originalMaterialStates = new Map();
const pieceMotion = new Map();

const initialCameraPosition = new THREE.Vector3();
const initialCameraTarget = new THREE.Vector3();
let cameraTransition = null;

const regionInfo = {
  DLPFC: {
    title: "Dorsolateral Prefrontal Cortex (Left)",
    description:
      "Primary target for treatment of depression with TMS due to its role in mood and cognition networks.",
    learnMore: "brain-regions.html#dlpfc"
  },

  Motor_Cortex: {
    title: "Primary Motor Cortex (M1)",
    description:
      "Reveals patient specific TMS settings to induce an E-field large enough to fire neurons in the DLPFC.",
    learnMore: "brain-regions.html#motor-cortex"
  },

  SGACC: {
    title: "Subgenual Anterior Cingulate Cortex",
    description:
      "Large contributor to a persons cognitive functioning and mood regulation. Directly anti-correlated with the DLPFC through neural pathways.",
    learnMore: "brain-regions.html#sgacc"
  }
};

const brainPieceInfo = {
  Left_Brain: {
    title: "Left Cerebral Hemisphere",
    description:
      "This section represents the surrounding left cerebral hemisphere and provides anatomical context for the highlighted DLPFC and motor cortex regions used in this project."
  },

  Right_Brain: {
    title: "Right Cerebral Hemisphere",
    description:
      "This section represents the remaining right cerebral hemisphere and is included primarily for anatomical orientation and context while exploring the TMS target regions."
  }
};


let popupDragState = null;

function clampBrainPiecePopupToContainer() {
  if (brainPiecePopup.classList.contains("hidden")) return;

  const margin = 10;
  const popupWidth = brainPiecePopup.offsetWidth;
  const popupHeight = brainPiecePopup.offsetHeight;

  const maxLeft = Math.max(
    margin,
    container.clientWidth - popupWidth - margin
  );

  const maxTop = Math.max(
    margin,
    container.clientHeight - popupHeight - margin
  );

  const currentLeft = Number.parseFloat(brainPiecePopup.style.left) ||
    brainPiecePopup.offsetLeft;
  const currentTop = Number.parseFloat(brainPiecePopup.style.top) ||
    brainPiecePopup.offsetTop;

  const clampedLeft = Math.min(
    maxLeft,
    Math.max(margin, currentLeft)
  );

  const clampedTop = Math.min(
    maxTop,
    Math.max(margin, currentTop)
  );

  brainPiecePopup.style.left = `${clampedLeft}px`;
  brainPiecePopup.style.top = `${clampedTop}px`;
  brainPiecePopup.style.right = "auto";
  brainPiecePopup.style.bottom = "auto";
}

function prepareBrainPiecePopupPosition() {
  window.requestAnimationFrame(() => {
    clampBrainPiecePopupToContainer();
  });
}

brainPiecePopupDragHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== undefined && event.button !== 0) return;

  popupDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: brainPiecePopup.offsetLeft,
    startTop: brainPiecePopup.offsetTop
  };

  brainPiecePopupDragHandle.setPointerCapture(event.pointerId);
  brainPiecePopup.classList.add("dragging");
  event.preventDefault();
  event.stopPropagation();
});

brainPiecePopupDragHandle.addEventListener("pointermove", (event) => {
  if (
    !popupDragState ||
    event.pointerId !== popupDragState.pointerId
  ) {
    return;
  }

  const nextLeft =
    popupDragState.startLeft + (event.clientX - popupDragState.startX);

  const nextTop =
    popupDragState.startTop + (event.clientY - popupDragState.startY);

  brainPiecePopup.style.left = `${nextLeft}px`;
  brainPiecePopup.style.top = `${nextTop}px`;
  brainPiecePopup.style.right = "auto";
  brainPiecePopup.style.bottom = "auto";

  clampBrainPiecePopupToContainer();
  event.preventDefault();
});

function finishBrainPiecePopupDrag(event) {
  if (
    !popupDragState ||
    event.pointerId !== popupDragState.pointerId
  ) {
    return;
  }

  if (
    brainPiecePopupDragHandle.hasPointerCapture &&
    brainPiecePopupDragHandle.hasPointerCapture(event.pointerId)
  ) {
    brainPiecePopupDragHandle.releasePointerCapture(event.pointerId);
  }

  popupDragState = null;
  brainPiecePopup.classList.remove("dragging");
  clampBrainPiecePopupToContainer();
}

brainPiecePopupDragHandle.addEventListener(
  "pointerup",
  finishBrainPiecePopupDrag
);

brainPiecePopupDragHandle.addEventListener(
  "pointercancel",
  finishBrainPiecePopupDrag
);

function showBrainPiecePopup(pieceKey) {
  const information = brainPieceInfo[pieceKey];

  if (!information) {
    hideBrainPiecePopup();
    return;
  }

  brainPiecePopupLabel.textContent = "BRAIN ANATOMY";
  brainPiecePopupTitle.textContent = information.title;
  brainPiecePopupText.textContent = information.description;
  brainPiecePopupLink.classList.add("hidden");
  brainPiecePopup.classList.remove("hidden");
  prepareBrainPiecePopupPosition();
}

function showRegionPopup(regionKey) {
  const information = regionInfo[regionKey];

  if (!information) {
    hideBrainPiecePopup();
    return;
  }

  brainPiecePopupLabel.textContent = "TMS REGION";
  brainPiecePopupTitle.textContent = information.title;
  brainPiecePopupText.textContent = information.description;
  brainPiecePopupLink.href = information.learnMore;
  brainPiecePopupLink.classList.remove("hidden");
  brainPiecePopup.classList.remove("hidden");
  prepareBrainPiecePopupPosition();
}

function hideBrainPiecePopup() {
  popupDragState = null;
  brainPiecePopup.classList.remove("dragging");
  brainPiecePopup.classList.add("hidden");
  brainPiecePopupLink.classList.add("hidden");
}

brainPiecePopupClose.addEventListener("click", (event) => {
  event.stopPropagation();
  hideBrainPiecePopup();
});


function cleanName(name) {
  return (name || "")
    .trim()
    .replace(/\.\d+$/, "")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function getPieceKeyFromName(name) {
  const cleaned = cleanName(name);

  if (cleaned === "DLPFC") return "DLPFC";

  if (
    cleaned === "MOTOR_CORTEX" ||
    cleaned === "MOTORCORTEX" ||
    cleaned === "M1"
  ) return "Motor_Cortex";

  if (
    cleaned === "SGACC" ||
    cleaned === "SG_ACC"
  ) return "SGACC";

  if (
    cleaned === "LEFT_BRAIN" ||
    cleaned === "LEFTBRAIN"
  ) return "Left_Brain";

  if (
    cleaned === "RIGHT_BRAIN" ||
    cleaned === "RIGHTBRAIN" ||
    cleaned === "RIGHT_BRAIN_REST"
  ) return "Right_Brain";

  return null;
}

function getRegionKey(object) {
  let current = object;

  while (current) {
    const pieceKey = getPieceKeyFromName(current.name);

    if (
      pieceKey === "DLPFC" ||
      pieceKey === "Motor_Cortex" ||
      pieceKey === "SGACC"
    ) return pieceKey;

    current = current.parent;
  }

  return null;
}

function getBrainPieceKey(object) {
  let current = object;

  while (current) {
    const pieceKey = getPieceKeyFromName(current.name);

    if (pieceKey) {
      return pieceKey;
    }

    current = current.parent;
  }

  return null;
}


function getMaterials(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function prepareBrainMaterials() {
  brain.traverse((object) => {
    if (!object.isMesh) return;

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => material.clone());
    } else {
      object.material = object.material.clone();
    }

    const states = getMaterials(object).map((material) => ({
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      color: material.color ? material.color.clone() : null,
      emissive: material.emissive ? material.emissive.clone() : null,
      emissiveIntensity: material.emissiveIntensity
    }));

    originalMaterialStates.set(object, states);
  });
}

function restoreObjectMaterial(mesh) {
  const savedStates = originalMaterialStates.get(mesh);
  if (!savedStates) return;

  getMaterials(mesh).forEach((material, index) => {
    const saved = savedStates[index];

    material.opacity = saved.opacity;
    material.transparent = saved.transparent;
    material.depthWrite = saved.depthWrite;

    if (material.color && saved.color) material.color.copy(saved.color);
    if (material.emissive && saved.emissive) material.emissive.copy(saved.emissive);

    if (saved.emissiveIntensity !== undefined) {
      material.emissiveIntensity = saved.emissiveIntensity;
    }

    material.needsUpdate = true;
  });
}

function restoreBrainMaterials() {
  if (!brain) return;

  brain.traverse((object) => {
    if (object.isMesh) restoreObjectMaterial(object);
  });
}

function dimObject(mesh, opacity) {
  getMaterials(mesh).forEach((material) => {
    material.transparent = true;
    material.opacity = opacity;
    material.depthWrite = false;
    material.needsUpdate = true;
  });
}

function highlightObject(mesh) {
  getMaterials(mesh).forEach((material) => {
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;

    if (material.emissive) {
      material.emissive.set(0x4f3f9e);
      material.emissiveIntensity = 0.5;
    }

    material.needsUpdate = true;
  });
}

function updateButtons(regionKey) {
  dlpfcButton.classList.toggle("active", regionKey === "DLPFC");
  motorButton.classList.toggle("active", regionKey === "Motor_Cortex");
  sgaccButton.classList.toggle("active", regionKey === "SGACC");
}

function findPieceRoots() {
  const candidates = new Map();

  brain.traverse((object) => {
    const pieceKey = getPieceKeyFromName(object.name);
    if (!pieceKey) return;

    const existing = candidates.get(pieceKey);

    if (!existing) {
      candidates.set(pieceKey, object);
      return;
    }

    let existingDepth = 0;
    let node = existing;

    while (node && node !== brain) {
      existingDepth++;
      node = node.parent;
    }

    let newDepth = 0;
    node = object;

    while (node && node !== brain) {
      newDepth++;
      node = node.parent;
    }

    if (newDepth < existingDepth) candidates.set(pieceKey, object);
  });

  return candidates;
}

function normalizePieceHierarchy(pieceRoots) {
  pieceRoots.forEach((object) => {
    if (object.parent !== brain) brain.attach(object);
  });

  brain.updateMatrixWorld(true);
}

function preparePieceMotion() {
  const roots = findPieceRoots();
  normalizePieceHierarchy(roots);

  roots.forEach((root, pieceKey) => {
    const pieceBox = new THREE.Box3().setFromObject(root);
    const centerWorld = pieceBox.getCenter(new THREE.Vector3());
    const centerLocal = brain.worldToLocal(centerWorld.clone());

    pieceMotion.set(pieceKey, {
      object: root,
      originalPosition: root.position.clone(),
      centerLocal,
      maxDistance: brainMaxDimension * 0.55
    });
  });
}

function restorePiecePositions() {
  pieceMotion.forEach((motion) => {
    motion.object.position.copy(motion.originalPosition);
  });

  if (brain) brain.updateMatrixWorld(true);
}

function applyExplodedView() {
  restorePiecePositions();

  if (!selectedRegion) return;

  const selectedMotion = pieceMotion.get(selectedRegion);
  if (!selectedMotion) return;

  const selectedCenter = selectedMotion.centerLocal;

  const fraction =
    Math.max(0, Math.min(100, Number(separationSlider.value))) / 100;

  pieceMotion.forEach((motion, pieceKey) => {
    if (pieceKey === selectedRegion) return;

    const direction = motion.centerLocal.clone().sub(selectedCenter);

    if (direction.lengthSq() < 1e-10) {
      direction.copy(motion.originalPosition).sub(selectedMotion.originalPosition);
    }

    if (direction.lengthSq() < 1e-10) direction.set(1, 0, 0);

    direction.normalize();

    const offset = direction.multiplyScalar(
      motion.maxDistance * fraction
    );

    motion.object.position
      .copy(motion.originalPosition)
      .add(offset);
  });

  brain.updateMatrixWorld(true);
}

function resetSeparationSlider(enabled) {
  separationSlider.value = "0";
  separationValue.textContent = "0%";
  separationSlider.disabled = !enabled;
  restorePiecePositions();

  separationHelp.textContent = enabled
    ? "Move the slider to keep the selected region fixed while every other brain piece moves directly away from it."
    : "Select DLPFC, Motor Cortex, or sgACC to enable the exploded view.";
}

function selectRegion(regionKey) {
  if (!brain) return;

  selectedRegion = regionKey;
  restoreBrainMaterials();
  resetSeparationSlider(true);

  brain.traverse((object) => {
    if (!object.isMesh) return;

    const objectRegion = getRegionKey(object);

    if (objectRegion === regionKey) {
      highlightObject(object);
    } else if (regionKey === "SGACC") {
      dimObject(object, 0.14);
    } else {
      dimObject(object, 0.38);
    }
  });

  showRegionPopup(regionKey);

  // Keep the right panel generic. Region descriptions live on the brain popup.

  updateButtons(regionKey);
}

function resetBrain() {
  hideBrainPiecePopup();
  selectedRegion = null;
  restoreBrainMaterials();
  resetSeparationSlider(false);

  updateButtons(null);
}

/* Panel */
function resizeRenderer() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (width <= 0 || height <= 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  clampBrainPiecePopupToContainer();
}

function setPanelCollapsed(collapsed) {
  viewerShell.classList.toggle("panel-collapsed", collapsed);
  window.setTimeout(resizeRenderer, 340);
}

panelCloseButton.addEventListener("click", () => setPanelCollapsed(true));
panelOpenButton.addEventListener("click", () => setPanelCollapsed(false));

/* Smooth camera */
function startCameraTransition(destination, target = new THREE.Vector3(0, 0, 0)) {
  const startTarget = controls.target.clone();
  const startRelative = camera.position.clone().sub(startTarget);
  const endRelative = destination.clone().sub(target);

  const startDistance = startRelative.length();
  const endDistance = endRelative.length();

  const startDirection = startRelative.clone().normalize();
  const endDirection = endRelative.clone().normalize();

  const rotation = new THREE.Quaternion().setFromUnitVectors(
    startDirection,
    endDirection
  );

  cameraTransition = {
    startTarget,
    endTarget: target.clone(),
    startDirection,
    rotation,
    startDistance,
    endDistance,
    startTime: performance.now(),
    duration: 800
  };

  controls.enabled = false;
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateCameraTransition() {
  if (!cameraTransition) return;

  const elapsed = performance.now() - cameraTransition.startTime;
  const rawT = Math.min(1, elapsed / cameraTransition.duration);
  const t = easeInOutCubic(rawT);

  const target = new THREE.Vector3().lerpVectors(
    cameraTransition.startTarget,
    cameraTransition.endTarget,
    t
  );

  const stepRotation = new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(),
    cameraTransition.rotation,
    t
  );

  const direction = cameraTransition.startDirection
    .clone()
    .applyQuaternion(stepRotation)
    .normalize();

  const distance = THREE.MathUtils.lerp(
    cameraTransition.startDistance,
    cameraTransition.endDistance,
    t
  );

  camera.position.copy(
    target.clone().add(
      direction.multiplyScalar(distance)
    )
  );

  controls.target.copy(target);
  camera.lookAt(target);

  if (rawT >= 1) {
    cameraTransition = null;
    controls.enabled = true;
    controls.update();
  }
}

function cameraDistance() {
  return brainMaxDimension * 2;
}

sideViewButton.addEventListener("click", () => {
  startCameraTransition(
    new THREE.Vector3(cameraDistance(), 0, 0)
  );
});

topViewButton.addEventListener("click", () => {
  startCameraTransition(
    new THREE.Vector3(
      0,
      cameraDistance(),
      cameraDistance() * 0.002
    )
  );
});

resetViewButton.addEventListener("click", () => {
  startCameraTransition(
    initialCameraPosition,
    initialCameraTarget
  );
});

/* Load model */
const loader = new GLTFLoader();

loader.load(
  "models/tms-brain.glb",
  (gltf) => {
    brain = gltf.scene;
    scene.add(brain);

    prepareBrainMaterials();

    const box = new THREE.Box3().setFromObject(brain);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    brain.position.x -= center.x;
    brain.position.y -= center.y;
    brain.position.z -= center.z;

    brainMaxDimension = Math.max(size.x, size.y, size.z);

    brain.updateMatrixWorld(true);
    preparePieceMotion();

    camera.position.set(0, 0, brainMaxDimension * 2);
    camera.near = brainMaxDimension / 100;
    camera.far = brainMaxDimension * 100;
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.update();

    initialCameraPosition.copy(camera.position);
    initialCameraTarget.copy(controls.target);

    loadingMessage.style.display = "none";
    resetSeparationSlider(false);
  },
  (xhr) => {
    if (xhr.total) {
      const percent = (xhr.loaded / xhr.total) * 100;
      loadingMessage.textContent =
        `Loading 3D brain... ${percent.toFixed(0)}%`;
    }
  },
  (error) => {
    console.error("Error loading brain:", error);
    loadingMessage.textContent = "Unable to load 3D brain.";
  }
);

/* Click selection */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function selectObjectFromPointer(event) {
  if (!brain) return;

  hideBrainPiecePopup();

  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObject(brain, true);

  if (intersections.length === 0) return;

  const clickedObject = intersections[0].object;
  const regionKey = getRegionKey(clickedObject);

  if (regionKey) {
    selectRegion(regionKey);
    return;
  }

  const pieceKey = getBrainPieceKey(clickedObject);

  if (
    pieceKey === "Left_Brain" ||
    pieceKey === "Right_Brain"
  ) {
    showBrainPiecePopup(pieceKey);
  }
}

let pointerStart = null;

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;

  const distance = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y
  );

  pointerStart = null;

  if (distance <= 5) selectObjectFromPointer(event);
});

dlpfcButton.addEventListener("click", () => selectRegion("DLPFC"));
motorButton.addEventListener("click", () => selectRegion("Motor_Cortex"));
sgaccButton.addEventListener("click", () => selectRegion("SGACC"));
resetButton.addEventListener("click", resetBrain);

separationSlider.addEventListener("input", () => {
  const value =
    Math.max(0, Math.min(100, Number(separationSlider.value)));

  separationValue.textContent = `${value}%`;
  applyExplodedView();
});

window.addEventListener("resize", resizeRenderer);


document.addEventListener("pointerdown", (event) => {
  if (
    !brainPiecePopup.classList.contains("hidden") &&
    !brainPiecePopup.contains(event.target) &&
    !viewerShell.contains(event.target)
  ) {
    hideBrainPiecePopup();
  }
});


function animate() {
  requestAnimationFrame(animate);
  updateCameraTransition();
  controls.update();
  renderer.render(scene, camera);
}

animate();
