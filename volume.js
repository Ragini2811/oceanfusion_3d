let threeVolume = null;
let threeVolumeRequest = 0;

function setupThreeVolumeViewer(container) {
	if (!window.THREE || threeVolume || !container) return;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	renderer.domElement.className = "three-volume-canvas";
	renderer.domElement.style.display = "none";
	container.appendChild(renderer.domElement);

	const group = new THREE.Group();
	scene.add(group);

	// Studio Lighting & Ambient Glow
	scene.add(new THREE.AmbientLight(0xdff4ff, 2.0));
	
	const mainLight = new THREE.DirectionalLight(0xffffff, 3.0);
	mainLight.position.set(12, 16, 14);
	scene.add(mainLight);

	const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
	fillLight.position.set(-10, -8, -10);
	scene.add(fillLight);

	// DEFAULT CAMERA ORIENTATION: Surface faces UPWARDS (North), Layers face FORWARD (towards the user / center)
	const state = {
		scene,
		camera,
		renderer,
		group,
		data: null,
		yaw: 0.0,
		pitch: 0.58,
		targetYaw: 0.0,
		targetPitch: 0.58,
		distance: 19.0,
		dragging: false,
		lastX: 0,
		lastY: 0,
		activeObs: null,
		activeFloatObj: null,
		particles: null,
		waterMesh: null,
		waterGeo: null,
		origPositions: null
	};

	// SLOW, SILKY ROTATION SPEED
	const ROTATION_SPEED = 0.0020;
	let clickStartX = 0, clickStartY = 0;

	renderer.domElement.addEventListener("pointerdown", event => {
		clickStartX = event.clientX;
		clickStartY = event.clientY;
		state.dragging = true;
		state.lastX = event.clientX;
		state.lastY = event.clientY;
		try { renderer.domElement.setPointerCapture(event.pointerId); } catch (_) { }
	});

	renderer.domElement.addEventListener("pointermove", event => {
		if (!state.dragging) return;
		state.targetYaw += (event.clientX - state.lastX) * ROTATION_SPEED;
		
		// Clamp pitch so rotation NEVER flips below horizon
		state.targetPitch = Math.max(0.15, Math.min(1.25, state.targetPitch + (event.clientY - state.lastY) * ROTATION_SPEED));
		
		state.lastX = event.clientX;
		state.lastY = event.clientY;
	});

	const releasePointer = event => {
		state.dragging = false;
		try { renderer.domElement.releasePointerCapture(event.pointerId); } catch (_) { }
	};

	renderer.domElement.addEventListener("pointerup", event => {
		releasePointer(event);
		const dist = Math.hypot(event.clientX - clickStartX, event.clientY - clickStartY);
		if (dist < 5) {
			pick3DFloat(event);
		}
	});

	renderer.domElement.addEventListener("pointercancel", releasePointer);

	renderer.domElement.addEventListener("dblclick", () => {
		state.targetYaw = 0.0;
		state.targetPitch = 0.58;
		state.distance = 19.0;
	});

	renderer.domElement.addEventListener("wheel", event => {
		event.preventDefault();
		state.distance = Math.max(10, Math.min(36, state.distance * (event.deltaY > 0 ? 1.05 : 0.95)));
	}, { passive: false });

	renderer.domElement.tabIndex = 0;

	threeVolume = state;
	addVolumeDepthLabels(container);
	add3DCalloutCard(container);

	let waveTime = 0;
	const render = () => {
		waveTime += 0.015;
		const width = container.clientWidth;
		const height = container.clientHeight;

		if (width && height) {
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		}

		// Smooth rotational damping
		state.yaw += (state.targetYaw - state.yaw) * 0.10;
		state.pitch += (state.targetPitch - state.pitch) * 0.10;

		const radius = state.distance;
		camera.position.set(
			Math.cos(state.yaw) * Math.cos(state.pitch) * radius,
			Math.sin(state.yaw) * Math.cos(state.pitch) * radius,
			Math.sin(state.pitch) * radius
		);
		camera.lookAt(0, 0, -1.5);

		// Animate ocean surface waves dynamically
		if (state.waterMesh && state.waterGeo && state.origPositions) {
			const posAttr = state.waterGeo.attributes.position;
			for (let i = 0; i < posAttr.count; i++) {
				const u = state.origPositions[i * 3];
				const v = state.origPositions[i * 3 + 1];
				const zWave = Math.sin(waveTime * 2.2 + u * 1.4 + v * 1.4) * 0.12 + Math.cos(waveTime * 1.8 + u * 0.8) * 0.08;
				posAttr.setZ(i, state.origPositions[i * 3 + 2] + zWave);
			}
			posAttr.needsUpdate = true;
		}

		// Animate lively ocean current flow particles
		if (state.particles && state.particles.geometry) {
			const pPos = state.particles.geometry.attributes.position;
			for (let i = 0; i < pPos.count; i++) {
				let px = pPos.getX(i) + 0.015;
				let py = pPos.getY(i) + Math.sin(waveTime + px) * 0.008;
				if (px > 6.0) px = -6.0;
				pPos.setXYZ(i, px, py, pPos.getZ(i));
			}
			pPos.needsUpdate = true;
		}

		// Animate floating buoys
		if (threeVolume && threeVolume.group) {
			threeVolume.group.children.forEach(child => {
				if (child.userData && child.userData.isFloat) {
					child.position.z = child.userData.baseZ + Math.sin(waveTime * 2.2 + child.position.x) * 0.07;
					if (child.userData.ring) {
						child.userData.ring.rotation.z += 0.01;
					}
				}
			});
		}

		renderer.render(scene, camera);
		updateCalloutLeaderLine(container);
		requestAnimationFrame(render);
	};
	render();
}

function pick3DFloat(event) {
	if (!threeVolume || !threeVolume.renderer || !threeVolume.camera || !threeVolume.group) return;
	const rect = threeVolume.renderer.domElement.getBoundingClientRect();
	const mouse = new THREE.Vector2(
		((event.clientX - rect.left) / rect.width) * 2 - 1,
		-((event.clientY - rect.top) / rect.height) * 2 + 1
	);

	const raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(mouse, threeVolume.camera);
	const intersects = raycaster.intersectObjects(threeVolume.group.children, true);

	for (let i = 0; i < intersects.length; i++) {
		let obj = intersects[i].object;

		// Traverse up to find float element containing observation data
		let targetObj = obj;
		while (targetObj && (!targetObj.userData || !targetObj.userData.obsData) && targetObj.parent && targetObj !== threeVolume.group) {
			targetObj = targetObj.parent;
		}

		if (targetObj && targetObj.userData && targetObj.userData.obsData) {
			const obs = targetObj.userData.obsData;
			// ALWAYS find and target the white surface sphere buoy ball mesh!
			let buoyBall = targetObj.userData.buoyMesh;
			if (!buoyBall && targetObj.userData.isBuoyBall) buoyBall = targetObj;
			if (!buoyBall && targetObj.parent && targetObj.parent.userData && targetObj.parent.userData.buoyMesh) {
				buoyBall = targetObj.parent.userData.buoyMesh;
			}
			if (!buoyBall) buoyBall = targetObj;

			update3DCalloutData(obs, buoyBall);
			break; // Stop after picking the first hit float!
		}
	}
}

function addVolumeDepthLabels(container) {
	let labels = container.querySelector(".volume-depth-labels");
	if (!labels) {
		labels = document.createElement("div");
		labels.className = "volume-depth-labels";
		container.appendChild(labels);
	}
	labels.innerHTML = `
		<div><span style="opacity:0.55; letter-spacing:1px; font-size:10px;">DEPTH</span></div>
		<div><span>0 m</span></div>
		<div><span class="highlight-depth">454 m</span></div>
		<div><span>3216 m</span></div>
	`;
}

function updateVolumeDepthLabels(maxDepth) {
	const labels = document.querySelector(".volume-depth-labels");
	if (!labels) return;
	const mid = Math.round(maxDepth * 0.45);
	labels.innerHTML = `
		<div><span style="opacity:0.55; letter-spacing:1px; font-size:10px;">DEPTH</span></div>
		<div><span>0 m</span></div>
		<div><span class="highlight-depth">${mid} m</span></div>
		<div><span>${Math.round(maxDepth)} m</span></div>
	`;
}

function add3DCalloutCard(container) {
	let card = container.querySelector("#modelCalloutCard");
	if (!card) {
		card = document.createElement("div");
		card.id = "modelCalloutCard";
		card.className = "model-callout-card";
		container.appendChild(card);
	}

	let svg = container.querySelector("#calloutLeaderSvg");
	if (!svg) {
		svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.id = "calloutLeaderSvg";
		svg.setAttribute("class", "callout-leader-svg");
		svg.innerHTML = `
			<line id="calloutLeaderLine" x1="0" y1="0" x2="0" y2="0" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 2"/>
			<circle id="calloutLeaderDot" cx="0" cy="0" r="4.5" fill="#fbbf24" stroke="#ffffff" stroke-width="1.8"/>
		`;
		container.appendChild(svg);
	}
}

// HIDE CALLOUT CARD UNTIL A FLOAT IS CLICKED
function hide3DCalloutData() {
	if (threeVolume) {
		threeVolume.activeObs = null;
		threeVolume.activeFloatObj = null;
	}
	const card = document.getElementById("modelCalloutCard");
	if (card) card.style.display = "none";
	const line = document.getElementById("calloutLeaderLine");
	const dot = document.getElementById("calloutLeaderDot");
	if (line) { line.setAttribute("x1", 0); line.setAttribute("y1", 0); line.setAttribute("x2", 0); line.setAttribute("y2", 0); }
	if (dot) { dot.setAttribute("cx", -100); dot.setAttribute("cy", -100); }

	const rightPanel = document.querySelector(".right-panel");
	if (rightPanel) {
		const src = (typeof selectedDataSource === "string" ? selectedDataSource.toUpperCase() : "ARGO");
		rightPanel.innerHTML = `
			<div class="right-card">
				<div class="right-card-title" style="color: #38bdf8; font-weight: 700; letter-spacing: 1px; font-size: 11px;">
					SELECTED OCEAN REGION
				</div>
				<div class="right-card-subtitle" style="margin-top: 6px; color: #94a3b8; font-size: 11px; line-height: 1.4;">
					Click any 3D ${src} Float buoy to view temperature & sensor observations.
				</div>
			</div>
		`;
	}
}

function update3DCalloutData(obs, floatObj = null) {
	if (threeVolume) {
		threeVolume.activeObs = obs;
		if (floatObj) {
			threeVolume.activeFloatObj = floatObj;
		}
	}

	const card = document.getElementById("modelCalloutCard");
	if (card) {
		const lat = Number(obs?.latitude || obs?.lat || 16.675).toFixed(3);
		const lon = Number(obs?.longitude || obs?.lon || 83.717).toFixed(3);
		const depth = Math.round(Number(obs?.pressure || obs?.depth || 0));
		const temp = Number(obs?.temperature || obs?.temp || 30.94).toFixed(2);
		const param = (typeof currentParameter === "string" ? currentParameter : "temperature");
		const unit = param === "salinity" ? "PSU" : (param === "oxygen" ? "µmol/kg" : "°C");
		const valStr = param === "salinity" ? (Number(obs?.salinity || 35.25).toFixed(2)) : temp;
		const zone = depth <= 10 ? "sea surface" : (depth <= 200 ? "thermocline" : "deep water");

		card.innerHTML = `
			<div class="callout-value-row">
				<span class="callout-val">${valStr}</span>
				<span class="callout-unit">${unit}</span>
			</div>
			<div class="callout-meta-lines">
				<div>lat <b>${lat}°</b> lon <b>${lon}°</b></div>
				<div>depth <b>${depth} m</b></div>
				<div class="callout-zone-tag">${zone}</div>
			</div>
		`;
		card.style.display = "block";
	}

	updateRightSideObservationPanel(obs);
}

function updateRightSideObservationPanel(obs) {
	const rightPanel = document.querySelector(".right-panel");
	if (!rightPanel) return;

	const lat = Number(obs?.latitude || obs?.lat || 16.675).toFixed(3);
	const lon = Number(obs?.longitude || obs?.lon || 83.717).toFixed(3);
	const depth = Math.round(Number(obs?.pressure || obs?.depth || 0));
	const temp = Number(obs?.temperature || obs?.temp || 28.5).toFixed(2);
	const sal = Number(obs?.salinity || 35.2).toFixed(2);
	const oxy = Number(obs?.oxygen || 210).toFixed(1);
	const src = (typeof selectedDataSource === "string" ? selectedDataSource.toUpperCase() : "ARGO");

	rightPanel.innerHTML = `
		<div class="right-card">
			<div class="right-card-title" style="color: #38bdf8; font-weight: 700; letter-spacing: 1px; font-size: 11px;">
				OBSERVATION DETAILS
			</div>
			<div class="right-card-subtitle" style="margin-bottom: 12px; color: #fbbf24; font-weight: 600; font-size: 12px;">
				${src} FLOAT / SENSOR PROBE
			</div>

			<div class="right-stat" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
				<span style="color:#94a3b8">LATITUDE</span><strong>${lat}° N</strong>
			</div>
			<div class="right-stat" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
				<span style="color:#94a3b8">LONGITUDE</span><strong>${lon}° E</strong>
			</div>
			<div class="right-stat" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
				<span style="color:#94a3b8">DEPTH</span><strong>${depth} m</strong>
			</div>
			<div class="right-stat" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
				<span style="color:#94a3b8">TEMPERATURE</span><strong style="color:#fbbf24">${temp} °C</strong>
			</div>
			<div class="right-stat" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
				<span style="color:#94a3b8">SALINITY</span><strong style="color:#38bdf8">${sal} PSU</strong>
			</div>
			<div class="right-stat" style="display:flex; justify-content:space-between; font-size:11px;">
				<span style="color:#94a3b8">OXYGEN</span><strong>${oxy} µmol/kg</strong>
			</div>
		</div>
	`;
}

function updateCalloutLeaderLine(container) {
	const card = container.querySelector("#modelCalloutCard");
	const line = container.querySelector("#calloutLeaderLine");
	const dot = container.querySelector("#calloutLeaderDot");
	if (!card || !line || !dot || card.style.display === "none") return;

	const cRect = container.getBoundingClientRect();
	const cardRect = card.getBoundingClientRect();

	let targetX = cRect.width * 0.5;
	let targetY = cRect.height * 0.5;

	// DYNAMIC 3D-TO-2D SCREEN PROJECTION: Leader arrow points directly to the clicked 3D white Argo float buoy ball!
	if (threeVolume && threeVolume.activeFloatObj && threeVolume.camera && threeVolume.renderer) {
		threeVolume.activeFloatObj.updateMatrixWorld(true);
		const worldPos = new THREE.Vector3();
		threeVolume.activeFloatObj.getWorldPosition(worldPos);
		worldPos.project(threeVolume.camera);

		const canvasRect = threeVolume.renderer.domElement.getBoundingClientRect();
		const screenX = canvasRect.left + (worldPos.x * 0.5 + 0.5) * canvasRect.width;
		const screenY = canvasRect.top + (-worldPos.y * 0.5 + 0.5) * canvasRect.height;

		targetX = screenX - cRect.left;
		targetY = screenY - cRect.top;
	}

	const cardLeftRel = cardRect.left - cRect.left;
	const cardRightRel = cardRect.right - cRect.left;
	const cardMidX = cardLeftRel + cardRect.width * 0.5;

	const cardX = (targetX < cardMidX) ? cardLeftRel : cardRightRel;
	const cardY = cardRect.top - cRect.top + cardRect.height * 0.5;

	line.setAttribute("x1", cardX);
	line.setAttribute("y1", cardY);
	line.setAttribute("x2", targetX);
	line.setAttribute("y2", targetY);

	dot.setAttribute("cx", targetX);
	dot.setAttribute("cy", targetY);
}

function clearThreeVolume() {
	if (!threeVolume) return;
	if (threeVolume.particles) {
		threeVolume.particles.geometry.dispose();
		threeVolume.particles.material.dispose();
		threeVolume.particles = null;
	}
	threeVolume.waterMesh = null;
	threeVolume.waterGeo = null;
	threeVolume.origPositions = null;
	threeVolume.activeFloatObj = null;

	while (threeVolume.group.children.length) {
		const child = threeVolume.group.children.pop();
		if (child.geometry) child.geometry.dispose();
		if (child.material) {
			if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
			else child.material.dispose();
		}
	}
}

// Builds 3D Ocean Volume Model
function createLivelyIndianOceanModel(width, height, depth) {
	// Water Surface Plane facing UPWARDS (North)
	const waterGeo = new THREE.PlaneGeometry(width * 1.1, height * 1.1, 48, 36);
	const waterMat = new THREE.MeshPhongMaterial({
		color: 0x0088dd,
		emissive: 0x002d55,
		transparent: true,
		opacity: 0.84,
		side: THREE.DoubleSide,
		shininess: 100
	});

	const waterMesh = new THREE.Mesh(waterGeo, waterMat);
	waterMesh.position.set(0, 0, 0);
	threeVolume.group.add(waterMesh);

	threeVolume.waterMesh = waterMesh;
	threeVolume.waterGeo = waterGeo;
	threeVolume.origPositions = Float32Array.from(waterGeo.attributes.position.array);

	// Water Layers facing FORWARD towards the user / center
	const layerColors = [0x0ea5e9, 0x0284c7, 0x0369a1, 0x075985, 0x0c4a6e];
	layerColors.forEach((col, idx) => {
		const layerGeo = new THREE.BoxGeometry(width * 1.05, height * 1.05, depth / layerColors.length);
		const layerMat = new THREE.MeshPhongMaterial({
			color: col,
			transparent: true,
			opacity: 0.78 - idx * 0.13,
			side: THREE.DoubleSide
		});
		const layerMesh = new THREE.Mesh(layerGeo, layerMat);
		layerMesh.position.set(0, 0, -0.5 - idx * (depth / layerColors.length));
		threeVolume.group.add(layerMesh);
	});

	// Flowing Ocean Current Particle System
	const particleCount = 240;
	const pGeo = new THREE.BufferGeometry();
	const pPos = new Float32Array(particleCount * 3);

	for (let i = 0; i < particleCount; i++) {
		pPos[i * 3] = (Math.random() - 0.5) * width * 1.0;
		pPos[i * 3 + 1] = (Math.random() - 0.5) * height * 1.0;
		pPos[i * 3 + 2] = -Math.random() * depth * 0.85;
	}

	pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
	const pMat = new THREE.PointsMaterial({
		color: 0x38bdf8,
		size: 0.18,
		transparent: true,
		opacity: 0.85
	});

	const particleSystem = new THREE.Points(pGeo, pMat);
	threeVolume.group.add(particleSystem);
	threeVolume.particles = particleSystem;

	// Wireframe Bounds
	const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 1.05, height * 1.05, depth));
	const edgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
	const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
	edgeLines.position.z = -depth / 2;
	threeVolume.group.add(edgeLines);
}

// Builds 3D Argo Float / Glider Buoy with Surface Sphere, Ring, Sensor Probe & Tether Line
function create3DArgoFloat(x, y, targetDepthZ, totalDepthZ, isPrimary = false, obsData = null) {
	const floatGroup = new THREE.Group();
	floatGroup.position.set(x, y, 0);

	// 1. Surface Metallic Sphere Buoy (White Float Ball!)
	const buoyGeo = new THREE.SphereGeometry(isPrimary ? 0.44 : 0.35, 24, 24);
	const buoyMat = new THREE.MeshPhongMaterial({
		color: isPrimary ? 0xffffff : 0xe2e8f0,
		specular: 0xffffff,
		shininess: 95
	});
	const buoyMesh = new THREE.Mesh(buoyGeo, buoyMat);
	buoyMesh.userData.obsData = obsData;
	buoyMesh.userData.isBuoyBall = true;
	buoyMesh.userData.buoyMesh = buoyMesh;
	floatGroup.add(buoyMesh);

	floatGroup.userData = { isFloat: true, baseZ: 0, obsData: obsData, buoyMesh: buoyMesh };

	// 2. Target Ring
	const ringGeo = new THREE.TorusGeometry(isPrimary ? 0.68 : 0.48, 0.05, 16, 36);
	const ringMat = new THREE.MeshPhongMaterial({
		color: isPrimary ? 0xffffff : 0x38bdf8,
		emissive: isPrimary ? 0xf59e0b : 0x0284c7,
		shininess: 100
	});
	const ringMesh = new THREE.Mesh(ringGeo, ringMat);
	ringMesh.rotation.x = Math.PI / 2;
	ringMesh.userData.obsData = obsData;
	ringMesh.userData.buoyMesh = buoyMesh;
	floatGroup.add(ringMesh);
	floatGroup.userData.ring = ringMesh;

	// 3. Antenna Top Pin
	const antGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.45, 8);
	const antMat = new THREE.MeshPhongMaterial({ color: 0x64748b });
	const antMesh = new THREE.Mesh(antGeo, antMat);
	antMesh.position.z = 0.38;
	antMesh.rotation.x = Math.PI / 2;
	antMesh.userData.obsData = obsData;
	antMesh.userData.buoyMesh = buoyMesh;
	floatGroup.add(antMesh);

	// 4. Vertical Tether Line
	const linePoints = [
		new THREE.Vector3(x, y, 0),
		new THREE.Vector3(x, y, targetDepthZ)
	];
	const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
	const lineMat = new THREE.LineBasicMaterial({
		color: isPrimary ? 0xfbbf24 : 0x7dd3fc,
		transparent: true,
		opacity: isPrimary ? 0.95 : 0.75,
		linewidth: 2
	});
	const tetherLine = new THREE.Line(lineGeo, lineMat);
	tetherLine.userData.obsData = obsData;
	tetherLine.userData.buoyMesh = buoyMesh;
	threeVolume.group.add(tetherLine);

	// 5. Sensor Probe & Halo Ring
	const probeGeo = new THREE.SphereGeometry(isPrimary ? 0.24 : 0.18, 16, 16);
	const probeMat = new THREE.MeshBasicMaterial({ color: isPrimary ? 0xf59e0b : 0x38bdf8 });
	const probeMesh = new THREE.Mesh(probeGeo, probeMat);
	probeMesh.position.set(x, y, targetDepthZ);
	probeMesh.userData.obsData = obsData;
	probeMesh.userData.buoyMesh = buoyMesh;
	threeVolume.group.add(probeMesh);

	const haloGeo = new THREE.TorusGeometry(isPrimary ? 0.42 : 0.32, 0.04, 12, 24);
	const haloMat = new THREE.MeshBasicMaterial({ color: 0xfcb338, transparent: true, opacity: 0.85 });
	const haloMesh = new THREE.Mesh(haloGeo, haloMat);
	haloMesh.position.set(x, y, targetDepthZ);
	haloMesh.userData.obsData = obsData;
	haloMesh.userData.buoyMesh = buoyMesh;
	threeVolume.group.add(haloMesh);

	threeVolume.group.add(floatGroup);
}

function renderSampleVolume(observations, maxDepth = 3216, bounds = null) {
	if (!threeVolume) return;
	clearThreeVolume();

	const width = 11;
	const height = 8;
	const depth = 4.8;

	createLivelyIndianOceanModel(width, height, depth);

	// Dataset source identification
	const src = (typeof selectedDataSource === "string" ? selectedDataSource.toLowerCase() : "argo");

	// Define dataset-specific observations & spatial float layouts
	let obsList = (observations && observations.length > 0) ? observations : [];
	if (!obsList.length) {
		if (src === "glider") {
			obsList = [
				{ latitude: 15.210, longitude: 72.100, pressure: 114, temperature: 27.85, salinity: 35.40, oxygen: 215 },
				{ latitude: 15.635, longitude: 73.120, pressure: 226, temperature: 22.40, salinity: 35.15, oxygen: 185 },
				{ latitude: 16.050, longitude: 74.150, pressure: 340, temperature: 16.10, salinity: 34.90, oxygen: 155 },
				{ latitude: 16.480, longitude: 75.180, pressure: 180, temperature: 24.30, salinity: 35.30, oxygen: 195 },
				{ latitude: 16.900, longitude: 76.200, pressure: 410, temperature: 12.50, salinity: 34.70, oxygen: 130 }
			];
		} else if (src === "model") {
			obsList = [
				{ latitude: 12.000, longitude: 70.000, pressure: 80, temperature: 29.50, salinity: 35.60, oxygen: 225 },
				{ latitude: 12.000, longitude: 75.000, pressure: 210, temperature: 23.10, salinity: 35.20, oxygen: 190 },
				{ latitude: 12.000, longitude: 80.000, pressure: 350, temperature: 15.80, salinity: 34.85, oxygen: 150 },
				{ latitude: 18.000, longitude: 70.000, pressure: 150, temperature: 26.20, salinity: 35.45, oxygen: 205 },
				{ latitude: 18.000, longitude: 75.000, pressure: 290, temperature: 18.40, salinity: 35.00, oxygen: 170 },
				{ latitude: 18.000, longitude: 80.000, pressure: 440, temperature: 11.20, salinity: 34.65, oxygen: 125 }
			];
		} else {
			obsList = [
				{ latitude: 16.675, longitude: 83.717, pressure: 50, temperature: 30.94, salinity: 35.20, oxygen: 230 },
				{ latitude: 15.200, longitude: 72.500, pressure: 454, temperature: 18.50, salinity: 35.80, oxygen: 175 },
				{ latitude: 8.500, longitude: 78.100, pressure: 1200, temperature: 8.20, salinity: 34.90, oxygen: 110 },
				{ latitude: 12.400, longitude: 74.800, pressure: 220, temperature: 23.25, salinity: 35.10, oxygen: 190 },
				{ latitude: 14.100, longitude: 81.200, pressure: 310, temperature: 17.60, salinity: 34.95, oxygen: 160 }
			];
		}
	}

	// Keep callout hidden until user clicks a float!
	hide3DCalloutData();

	if (bounds && bounds.west !== undefined && bounds.east !== undefined && bounds.south !== undefined && bounds.north !== undefined) {
		const lonSpan = Math.max(0.01, bounds.east - bounds.west);
		const latSpan = Math.max(0.01, bounds.north - bounds.south);

		obsList.slice(0, 8).forEach((obs, idx) => {
			const relLon = (Number(obs.longitude || obs.lon || bounds.centerLon) - bounds.west) / lonSpan;
			const relLat = (Number(obs.latitude || obs.lat || bounds.centerLat) - bounds.south) / latSpan;
			const fx = (Math.max(0.05, Math.min(0.95, relLon)) - 0.5) * (width * 0.75);
			const fy = (Math.max(0.05, Math.min(0.95, relLat)) - 0.5) * (height * 0.75);
			const press = Number(obs.pressure || obs.depth || 0);
			const targetZ = -Math.min(depth * 0.9, Math.max(0.3, (press / maxDepth) * depth));

			create3DArgoFloat(fx, fy, targetZ, depth, idx === 0, obs);
		});
	} else {
		// Dynamic sample float positions per dataset
		let buoyPositions;
		if (src === "glider") {
			// Glider transect line trajectory
			buoyPositions = [
				{ x: -3.8, y: -2.2 },
				{ x: -1.9, y: -0.9 },
				{ x: 0.0, y: 0.3 },
				{ x: 1.8, y: 1.5 },
				{ x: 3.5, y: 2.6 }
			];
		} else if (src === "model") {
			// Model numerical grid network
			buoyPositions = [
				{ x: -3.2, y: 1.8 },
				{ x: 0.0, y: 1.8 },
				{ x: 3.2, y: 1.8 },
				{ x: -3.2, y: -1.8 },
				{ x: 0.0, y: -1.8 },
				{ x: 3.2, y: -1.8 }
			];
		} else {
			// Argo profiling float cluster
			buoyPositions = [
				{ x: -3.2, y: 0.8 },
				{ x: 3.0, y: 0.4 },
				{ x: -0.4, y: -2.8 },
				{ x: -2.4, y: -1.2 },
				{ x: 1.5, y: -1.9 }
			];
		}

		obsList.slice(0, buoyPositions.length).forEach((obs, idx) => {
			const pos = buoyPositions[idx];
			const press = Number(obs.pressure || obs.depth || 0);
			const targetZ = -Math.min(depth * 0.9, Math.max(0.3, (press / maxDepth) * depth));
			create3DArgoFloat(pos.x, pos.y, targetZ, depth, idx === 0, obs);
		});
	}

	threeVolume.data = { depth: [0, maxDepth] };
	updateVolumeDepthLabels(maxDepth);

	const container = threeVolume.renderer.domElement.parentElement;
	if (container) container.style.display = "block";
	threeVolume.renderer.domElement.style.display = "block";
}

function renderThreeVolume(data, observations, bounds = null) {
	if (!threeVolume || !data) return;

	const [depthCount, latCount, lonCount] = data.shape;
	const field = currentParameter === "salinity" ? "salinity" : "temperature";
	const values = data[field];
	const range = data[field + "Range"];
	const texture = new THREE.Data3DTexture(new Float32Array(values), lonCount, latCount, depthCount);
	texture.format = THREE.RedFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;

	clearThreeVolume();
	const width = 11;
	const height = 8;
	const maxDepth = Math.max(...data.depth, 3216);
	const volumeDepth = 4.8;
	threeVolume.data = data;
	updateVolumeDepthLabels(maxDepth);

	const uniforms = { volume: { value: texture }, valueMin: { value: range[0] }, valueMax: { value: range[1] }, depthIndex: { value: 0 }, depthCount: { value: depthCount } };
	for (let depthIndex = 0; depthIndex < depthCount; depthIndex++) {
		const material = new THREE.ShaderMaterial({
			uniforms: THREE.UniformsUtils.clone(uniforms),
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
			vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
			fragmentShader: "precision highp sampler3D;uniform sampler3D volume;uniform float valueMin;uniform float valueMax;uniform float depthIndex;uniform float depthCount;varying vec2 vUv;void main(){float z=(depthIndex+.5)/depthCount;float v=texture(volume,vec3(vUv,z)).r;float t=clamp((v-valueMin)/max(.0001,valueMax-valueMin),0.,1.);vec3 c=vec3(.04+1.1*t,.35+.6*(1.-abs(t-.5)*2.),1.-t);gl_FragColor=vec4(c,.78);}"
		});
		material.uniforms.depthIndex.value = depthIndex;
		const slice = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.75, height), material);
		slice.position.set(-width * 0.10, 0, -(data.depth[depthIndex] / maxDepth) * volumeDepth);
		threeVolume.group.add(slice);
	}

	createLivelyIndianOceanModel(width, height, volumeDepth);
	hide3DCalloutData();

	const rows = (observations || []).slice(0, 8);
	if (rows.length) {
		const buoyPositions = [
			{ x: -3.2, y: 0.8 },
			{ x: 3.0, y: 0.4 },
			{ x: -0.4, y: -2.8 },
			{ x: -2.4, y: -1.2 }
		];
		rows.forEach((row, idx) => {
			const pos = buoyPositions[idx % buoyPositions.length];
			const press = Number(row.pressure || row.depth || 0);
			const targetZ = -Math.min(volumeDepth * 0.9, Math.max(0.3, (press / maxDepth) * volumeDepth));
			create3DArgoFloat(pos.x, pos.y, targetZ, volumeDepth, idx === 0, row);
		});
	}

	const container = threeVolume.renderer.domElement.parentElement;
	container.style.display = "block";
	threeVolume.renderer.domElement.style.display = "block";
	threeVolume.renderer.domElement.style.pointerEvents = "auto";
	const modelTitle = document.getElementById("modelViewerTitle");
	if (modelTitle) modelTitle.style.display = "block";
}

async function loadThreeVolume(bounds, observations) {
	if (!threeVolume || !bounds) return;
	renderSampleVolume(observations, bounds.maxDepth || 3216, bounds);
	const requestId = ++threeVolumeRequest;
	const params = new URLSearchParams({ west: bounds.west, east: bounds.east, south: bounds.south, north: bounds.north, maxDepth: bounds.maxDepth || 3216 });
	try {
		const response = await fetch("http://127.0.0.1:8001/api/volume?" + params);
		if (!response.ok) throw new Error("Volume service returned " + response.status);
		const data = await response.json();
		if (requestId === threeVolumeRequest) renderThreeVolume(data, observations, bounds);
	}
	catch (error) {
		console.log("Showing 3D model generated for selected globe region.");
	}
}
