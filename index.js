
document.addEventListener("DOMContentLoaded", () => {
    let scene, camera, renderer, controls;
    let models = [null, null];
    let bodyAgeDataBefore = { value: null, source: 'calculated' };
    let bodyAgeDataAfter = { value: null, source: 'calculated' };
    let lastDisplayedBodyAge = null;
    let lastDisplayedBodyAgeAfter = null;
    let lastDisplayedBmi = null;
    let lastDisplayedBmiAfter = null;
    let measurementsBefore = [];
    let measurementsAfter = [];
    let reportDataBefore = null;
    let reportDataAfter = null;
    let beforeRhr = null;
    let beforeBpSystolic = null;
    let beforeBpDiastolic = null;
    // --- 3D VIEWER SETUP ---
    const viewer = document.getElementById("viewer");
    if (!viewer)
        return;
    scene = new THREE.Scene();
    scene.background = null; // Use transparent background
    camera = new THREE.PerspectiveCamera(75, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Enable transparency
    renderer.setClearColor(0x000000, 0); // Set clear color to transparent
    renderer.physicallyCorrectLights = true; // Use physically correct lighting model
    renderer.outputEncoding = THREE.sRGBEncoding; // For correct color output
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // For a more cinematic look
    renderer.toneMappingExposure = 1.0;
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewer.innerHTML = "";
    viewer.appendChild(renderer.domElement);
    // OrbitControls for trackpad + mouse
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableRotate = true;
    // --- Professional Lighting Setup for Realism ---
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(-5, 5, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048; // Higher resolution shadows
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(5, 2, 5);
    scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
    backLight.position.set(0, 3, -5);
    scene.add(backLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    // Add an adjustable accent spotlight from above
    const accentSpotLight = new THREE.SpotLight(0xffffff, 0.5); // White color
    accentSpotLight.position.set(0, 10, 2); // Positioned above and slightly forward
    accentSpotLight.angle = Math.PI / 6; // A reasonable cone angle
    accentSpotLight.penumbra = 0.5; // Soft edges for the spotlight
    accentSpotLight.decay = 2;
    accentSpotLight.distance = 50;
    accentSpotLight.castShadow = true; // Enable shadows for more depth
    accentSpotLight.shadow.mapSize.width = 1024;
    accentSpotLight.shadow.mapSize.height = 1024;
    scene.add(accentSpotLight);
    scene.add(accentSpotLight.target); // Crucial: Add target to scene for matrix updates
    camera.position.set(0, 1.5, 7);
    controls.update();
    let autoSpin = false;
    const animateSpinBtn = document.getElementById("animateSpinBtn");
    if (animateSpinBtn) {
        animateSpinBtn.addEventListener("click", () => {
            autoSpin = !autoSpin;
            animateSpinBtn.textContent = autoSpin ? "Stop Spin" : "Auto Spin";
            animateSpinBtn.classList.toggle('active', autoSpin);
        });
    }
    let spinValue = 0;
    function animate() {
        requestAnimationFrame(animate);
        if (autoSpin) {
            models.forEach(model => {
                if (model) {
                    model.rotation.z += 0.01;
                    spinValue = model.rotation.z; // This will reflect the last model's rotation
                }
            });
            if (spinDial)
                spinDial.setRotation(spinValue);
        }
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    function updateModelsAndCamera() {
        const activeModels = models.filter(m => m !== null);
        if (activeModels.length === 0) {
            camera.position.set(0, 1.5, 7);
            controls.target.set(0, 1.5, 0);
            controls.update();
            return;
        }
        const overallBox = new THREE.Box3();
        activeModels.forEach((model, index) => {
            // Recalculate bounding box for positioning
            const modelBox = new THREE.Box3().setFromObject(model);
            const modelSize = modelBox.getSize(new THREE.Vector3());
            // Position models side-by-side if there are two
            if (activeModels.length === 2) {
                const model1Box = new THREE.Box3().setFromObject(activeModels[0]);
                const model1Size = model1Box.getSize(new THREE.Vector3());
                const model2Box = new THREE.Box3().setFromObject(activeModels[1]);
                const model2Size = model2Box.getSize(new THREE.Vector3());
                const gap = 0.5;
                activeModels[0].position.x = -model1Size.x / 2 - gap / 2;
                activeModels[1].position.x = model2Size.x / 2 + gap / 2;
            }
            else {
                // Center the single model
                model.position.x = 0;
            }
            // Update the overall bounding box
            const positionedBox = new THREE.Box3().setFromObject(model);
            overallBox.union(positionedBox);
        });
        const center = overallBox.getCenter(new THREE.Vector3());
        const size = overallBox.getSize(new THREE.Vector3());
        // Frame the scene
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        camera.position.set(center.x, center.y, center.z + cameraZ * 1.2);
        camera.lookAt(center);
        // Make sure the spotlight points at the center of the models
        accentSpotLight.target.position.copy(center);
        controls.target.copy(center);
        controls.update();
    }
    function addModelToScene(gltf, index) {
        if (models[index]) {
            scene.remove(models[index]);
        }
        const model = gltf.scene;
        // Create a high-quality, physically-based material
        const material = new THREE.MeshStandardMaterial({
            color: 0xe0e0e0,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE.DoubleSide // Render both sides, good practice for scanned meshes
        });
        model.traverse(function (child) {
            if (child.isMesh) {
                child.material = material; // Apply the new material
                child.castShadow = true;
                child.receiveShadow = true; // Allow meshes to receive shadows
            }
        });
        // Initial setup before positioning
        model.rotation.set(0, 0, 0);
        model.position.set(0, 0, 0);
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);
        model.rotation.x = -Math.PI / 2;
        model.scale.setScalar(1.5);
        // Set vertical position so base is at y=0
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;
        scene.add(model);
        models[index] = model;
        updateModelsAndCamera();
    }
    function loadAvatar(file, index) {
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = function (e) {
            var _a;
            const contents = (_a = e.target) === null || _a === void 0 ? void 0 : _a.result;
            if (typeof contents !== 'string')
                return;
            const objLoader = new THREE.OBJLoader();
            const obj = objLoader.parse(contents);
            // The GLTFExporter roundtrip is complex and might be the source of the error.
            // We can simplify by directly using the parsed OBJ group.
            // `addModelToScene` expects an object with a `scene` property.
            addModelToScene({ scene: obj }, index);
        };
        reader.readAsText(file);
    }
    function removeAvatar(index) {
        if (models[index]) {
            scene.remove(models[index]);
            models[index] = null;
            updateModelsAndCamera();
        }
    }
    // --- FILE INPUT HANDLERS ---
    document.querySelectorAll('.avatar-file-input').forEach(input => {
        input.addEventListener('change', function (event) {
            var _a;
            const target = event.target;
            const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
            const index = parseInt(target.dataset.index || '0', 10);
            if (file) {
                loadAvatar(file, index);
                document.getElementById(`removeAvatar${index + 1}`).style.display = 'block';
            }
        });
    });
    document.querySelectorAll('.remove-avatar-btn').forEach(button => {
        button.addEventListener('click', function (event) {
            const target = event.target;
            const index = parseInt(target.dataset.index || '0', 10);
            removeAvatar(index);
            document.getElementById(`avatarFile${index + 1}`).value = '';
            target.style.display = 'none';
        });
    });
    // --- DIALS LOGIC ---
    function createDial(dialElement, onDelta) {
        if (!dialElement)
            return null;
        const handle = dialElement.querySelector('.dial-handle');
        if (!handle)
            return null;
        let lastAngle = null;
        let dragging = false;
        let totalRotation = 0;
        function updateRotation(rad) {
            totalRotation = rad;
            handle.style.transform = `rotate(${totalRotation}rad)`;
        }
        function getAngle(e) {
            const rect = dialElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - centerX;
            const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - centerY;
            return Math.atan2(y, x);
        }
        function onPointerDown(e) {
            dragging = true;
            lastAngle = getAngle(e);
            dialElement.style.cursor = 'grabbing';
            e.preventDefault();
        }
        function onPointerMove(e) {
            if (!dragging || lastAngle === null)
                return;
            const angle = getAngle(e);
            let delta = angle - lastAngle;
            if (delta > Math.PI)
                delta -= 2 * Math.PI;
            if (delta < -Math.PI)
                delta += 2 * Math.PI;
            updateRotation(totalRotation + delta);
            lastAngle = angle;
            if (typeof onDelta === "function")
                onDelta(delta);
            e.preventDefault();
        }
        function onPointerUp(e) {
            dragging = false;
            dialElement.style.cursor = 'grab';
            e.preventDefault();
        }
        dialElement.addEventListener("mousedown", onPointerDown);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
        dialElement.addEventListener("touchstart", onPointerDown, { passive: false });
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp, { passive: false });
        updateRotation(0);
        return {
            setRotation(rad) {
                updateRotation(rad);
            },
            getRotation() {
                return totalRotation;
            }
        };
    }
    const spinDial = createDial(document.getElementById("spinDial"), function (delta) {
        spinValue += delta;
        models.forEach(model => {
            if (model)
                model.rotation.z = spinValue;
        });
    });
    let keyLightIntensity = keyLight ? keyLight.intensity : 0.8;
    const lightMin = 0.10;
    const lightMax = 2.00;
    const lightDialScale = 0.35;
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function updateLightDisplay() {
        const el = document.getElementById('lightValue');
        if (el)
            el.textContent = (keyLightIntensity).toFixed(2);
    }
    const lightDial = createDial(document.getElementById('lightDial'), function (delta) {
        keyLightIntensity = clamp(keyLightIntensity + (delta * lightDialScale), lightMin, lightMax);
        if (keyLight)
            keyLight.intensity = keyLightIntensity;
        if (fillLight)
            fillLight.intensity = keyLightIntensity * 0.5;
        if (backLight)
            backLight.intensity = keyLightIntensity * 0.75;
        if (accentSpotLight)
            accentSpotLight.intensity = keyLightIntensity * 0.6;
        updateLightDisplay();
    });
    if (keyLight && lightDial) {
        keyLightIntensity = clamp(keyLight.intensity, lightMin, lightMax);
        const initialLightRotation = ((keyLightIntensity - lightMin) / (lightMax - lightMin) - 0.5) * Math.PI * 2;
        lightDial.setRotation(initialLightRotation);
        updateLightDisplay();
    }
    window.addEventListener("resize", () => {
        const vw = Math.max(1, viewer.clientWidth);
        const vh = Math.max(1, viewer.clientHeight);
        camera.aspect = vw / vh;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(vw, vh);
        updateModelsAndCamera();
        updateCalculatedFields();
    });
    // --- METRICS CALCULATION AND VISUALIZATION LOGIC ---
    function getBmiLabel(bmi) {
        if (bmi === null || !isFinite(bmi)) {
            return "";
        }
        else if (bmi < 18.5) {
            return "Underweight";
        }
        else if (bmi < 25) {
            return "Healthy";
        }
        else if (bmi < 30) {
            return "Overweight";
        }
        else {
            return "Obese";
        }
    }
    function updateBmiGauge(bmi, suffix = '', bmiBefore) {
        const needle = document.getElementById("bmiNeedle" + suffix);
        const valueEl = document.getElementById("bmiGaugeValue" + suffix);
        const labelEl = document.getElementById("bmiGaugeLabel" + suffix);
        const changeEl = document.getElementById("bmiGaugeChange" + suffix);
        if (!needle || !valueEl || !labelEl)
            return;
        const minBmi = 14, maxBmi = 40;
        const minAngle = -90, maxAngle = 90;
        let value = isFinite(bmi) ? Math.max(minBmi, Math.min(maxBmi, bmi)) : minBmi;
        const pct = (value - minBmi) / (maxBmi - minBmi);
        const angle = minAngle + pct * (maxAngle - minAngle);
        needle.style.transform = `rotate(${angle}deg)`;
        let lastDisplayed = suffix === '_after' ? lastDisplayedBmiAfter : lastDisplayedBmi;
        if (isFinite(bmi)) {
            const startValue = lastDisplayed !== null && isFinite(lastDisplayed) ? lastDisplayed : Math.max(14, bmi - 10);
            animateValue(valueEl, startValue, bmi, 500, 1);
            if (suffix === '_after') {
                lastDisplayedBmiAfter = bmi;
            }
            else {
                lastDisplayedBmi = bmi;
            }
        }
        else {
            valueEl.textContent = '--';
            if (suffix === '_after') {
                lastDisplayedBmiAfter = null;
            }
            else {
                lastDisplayedBmi = null;
            }
        }
        if (labelEl)
            labelEl.textContent = getBmiLabel(bmi);
        if (changeEl && bmiBefore !== undefined && isFinite(bmiBefore) && isFinite(bmi)) {
            const difference = bmi - bmiBefore;
            changeEl.style.display = 'block';
            changeEl.classList.remove('positive', 'negative');
            if (difference > 0.05) {
                changeEl.textContent = `+${difference.toFixed(1)}`;
                changeEl.classList.add('positive');
            }
            else if (difference < -0.05) {
                changeEl.textContent = `${difference.toFixed(1)}`;
                changeEl.classList.add('negative');
            }
            else {
                changeEl.textContent = `0.0`;
            }
        }
        else if (changeEl) {
            changeEl.style.display = 'none';
            changeEl.textContent = '';
        }
    }
    function getBpCategory(systolic, diastolic) {
        if (!isFinite(systolic) || !isFinite(diastolic) || systolic <= 0 || diastolic <= 0) {
            return { label: "", color: "var(--medium-gray)", flashColor: null };
        }
        if (systolic >= 180 || diastolic >= 110) {
            return { label: "Grade 3 Hypertension", color: "var(--danger-red)", flashColor: "red" };
        }
        if (systolic >= 160 || diastolic >= 100) {
            return { label: "Grade 2 Hypertension", color: "var(--danger-red)", flashColor: null };
        }
        if (systolic >= 140 || diastolic >= 90) {
            return { label: "Grade 1 Hypertension", color: "var(--warning-orange)", flashColor: "yellow" };
        }
        if (systolic >= 130 || diastolic >= 85) {
            return { label: "High-normal", color: "var(--warning-orange)", flashColor: null };
        }
        if (systolic >= 120 || diastolic >= 80) {
            return { label: "Normal", color: "var(--healthy-green)", flashColor: null };
        }
        if (systolic < 120 && diastolic < 80) {
            return { label: "Optimal", color: "var(--healthy-green)", flashColor: null };
        }
        // Fallback for any unhandled cases, defaulting to Normal as per logic.
        return { label: "Normal", color: "var(--healthy-green)", flashColor: null };
    }
    function updateVerticalBloodPressure(systolic, diastolic) {
        const sysFill = document.getElementById("bpSystolicFill");
        const diaFill = document.getElementById("bpDiastolicFill");
        const sysValEl = document.getElementById("bpSystolicValue");
        const diaValEl = document.getElementById("bpDiastolicValue");
        const labelEl = document.getElementById("bpGaugeLabel");
        const indicatorEl = document.getElementById("bpIndicator");
        if (!sysFill || !diaFill || !sysValEl || !diaValEl || !labelEl || !indicatorEl)
            return;
        const sVal = parseFloat(systolic);
        const dVal = parseFloat(diastolic);
        const sysMin = 80, sysMax = 180;
        const diaMin = 50, diaMax = 120;
        let sPct = isFinite(sVal) ? (sVal - sysMin) / (sysMax - sysMin) * 100 : 0;
        sysFill.style.height = `${Math.max(0, Math.min(100, sPct))}%`;
        if (sysValEl)
            sysValEl.textContent = isFinite(sVal) ? sVal.toFixed(0) : '--';
        let dPct = isFinite(dVal) ? (dVal - diaMin) / (diaMax - diaMin) * 100 : 0;
        diaFill.style.height = `${Math.max(0, Math.min(100, dPct))}%`;
        if (diaValEl)
            diaValEl.textContent = isFinite(dVal) ? dVal.toFixed(0) : '--';
        const cat = getBpCategory(sVal, dVal);
        sysFill.style.backgroundColor = cat.color;
        diaFill.style.backgroundColor = cat.color;
        labelEl.textContent = cat.label;
        labelEl.style.color = cat.color;
        indicatorEl.style.backgroundColor = cat.color;
        indicatorEl.classList.remove('flash-red', 'flash-yellow');
        if (cat.flashColor === 'red') {
            indicatorEl.classList.add('flash-red');
        }
        else if (cat.flashColor === 'yellow') {
            indicatorEl.classList.add('flash-yellow');
        }
    }
    function calculateBodyAge(age, gender, bmi, rhr, visceralFat, bpSystolic) {
        let ageAdjustment = 0;
        // 1. BMI Adjustment (Gender-specific thresholds)
        const healthyBmiUpper = gender === 'M' ? 25 : 24;
        if (bmi > healthyBmiUpper) {
            const bmiPenaltyFactor = gender === 'M' ? 1.2 : 1.3;
            ageAdjustment += (bmi - healthyBmiUpper) * bmiPenaltyFactor;
        }
        else if (bmi < 22 && bmi > 19) {
            ageAdjustment -= (22 - bmi) * 0.75; // Reward for being in the healthy-lean range
        }
        // 2. Visceral Fat Adjustment (Increased penalty)
        if (visceralFat > 2) {
            ageAdjustment += (visceralFat - 2) * 2; // Increased from 1.5 to 2
        }
        // 3. Resting Heart Rate (RHR) Adjustment
        if (rhr > 75) {
            ageAdjustment += (rhr - 75) * 0.3;
        }
        else if (rhr < 60) {
            ageAdjustment -= (60 - rhr) * 0.3;
        }
        // 4. Blood Pressure (Systolic) Adjustment (More granular and impactful)
        if (bpSystolic > 120) {
            ageAdjustment += (bpSystolic - 120) / 4; // Each 4 points over 120 adds 1 year
        }
        const result = age + ageAdjustment;
        return isFinite(result) ? Math.round(result) : null;
    }
    function updateHealthRiskGauge() {
        var _a, _b, _c, _d;
        const marker = document.getElementById("healthRiskMarker");
        const label = document.getElementById("healthRiskLabel");
        if (!marker || !label)
            return;
        // Use the 'after' data if available, otherwise fallback to 'before'
        const bmi = (_b = (_a = lastDisplayedBmiAfter) !== null && _a !== void 0 ? _a : lastDisplayedBmi) !== null && _b !== void 0 ? _b : 0;
        let visceralFat = 0;
        const visceralFatAfterEl = document.getElementById('visceralFat_after');
        const visceralFatBeforeEl = document.getElementById('visceralFat');
        if (reportDataAfter && (visceralFatAfterEl === null || visceralFatAfterEl === void 0 ? void 0 : visceralFatAfterEl.value)) {
            visceralFat = parseFloat(visceralFatAfterEl.value) || 0;
        }
        else if (visceralFatBeforeEl === null || visceralFatBeforeEl === void 0 ? void 0 : visceralFatBeforeEl.value) {
            visceralFat = parseFloat(visceralFatBeforeEl.value) || 0;
        }
        const bpSystolic = parseFloat(document.getElementById('bpSystolic').value) || 0;
        const bpDiastolic = parseFloat(document.getElementById('bpDiastolic').value) || 0;
        const bodyAge = (_d = (_c = lastDisplayedBodyAgeAfter) !== null && _c !== void 0 ? _c : lastDisplayedBodyAge) !== null && _d !== void 0 ? _d : 0;
        const actualAge = parseInt(document.getElementById("age").value, 10) || 0;
        let riskScore = 0;
        // 1. BMI Risk (Max 2)
        if (bmi >= 30) {
            riskScore += 2;
        }
        else if (bmi >= 25 || (bmi < 18.5 && bmi > 0)) {
            riskScore += 1;
        }
        // 2. Visceral Fat Risk (Max 2)
        if (visceralFat > 5) {
            riskScore += 2;
        }
        else if (visceralFat >= 2) {
            riskScore += 1;
        }
        // 3. Blood Pressure Risk (Max 2)
        if (bpSystolic >= 160 || bpDiastolic >= 100) {
            riskScore += 2;
        }
        else if (bpSystolic >= 130 || bpDiastolic >= 85) {
            riskScore += 1;
        }
        // 4. Body Age Risk (Max 2)
        if (actualAge > 0 && bodyAge > actualAge + 10) {
            riskScore += 2;
        }
        else if (actualAge > 0 && bodyAge > actualAge) {
            riskScore += 1;
        }
        const maxScore = 8;
        const riskPercent = Math.min(100, Math.max(0, (riskScore / maxScore) * 100));
        let riskCategory = "Low";
        if (riskScore >= 5) {
            riskCategory = "High";
        }
        else if (riskScore >= 2) {
            riskCategory = "Moderate";
        }
        marker.style.left = `${riskPercent}%`;
        label.textContent = riskCategory;
    }
    function updateCalculatedFields() {
        var _a, _b;
        // This object holds the data for the *currently displayed* report in the top panel.
        const currentReportData = reportDataAfter || reportDataBefore;
        // --- Get values from DOM for fields that are staying ---
        const height = Number(document.getElementById("height").value) || 0;
        const weight = parseFloat(document.getElementById("weight").value) || 0;
        const gender = document.getElementById("gender").value;
        const age = parseInt(document.getElementById("age").value, 10) || 0;
        const rhr = parseFloat(document.getElementById("restingHeartRate").value) || 0;
        const bpSystolic = parseFloat(document.getElementById('bpSystolic').value) || 120;
        // --- Get values for removed fields from the report data object ---
        const num = (v) => { const n = parseFloat(String(v || '0')); return isFinite(n) ? n : 0; };
        const bodyFatPercent = currentReportData ? num(currentReportData['Body Fat %']) : 0;
        const waist = currentReportData ? num(currentReportData['Waist (Abdominal)'] || currentReportData['Waist Circumference']) : 0;
        const hip = currentReportData ? num(currentReportData['Hip'] || currentReportData['Hip Circumference']) : 0;
        // --- Calculate and Display Current Metrics ---
        const heightInMeters = height * 0.0254;
        const weightInKg = weight * 0.453592;
        let bmi = heightInMeters > 0 ? weightInKg / (heightInMeters * heightInMeters) : 0;
        const leanMassLbs = weight - (weight * (bodyFatPercent / 100));
        const leanMassKg = leanMassLbs * 0.453592;
        const bmr = 370 + (21.6 * leanMassKg);
        const rmr = bmr * 1.1;
        const bmrValueEl = document.getElementById("bmrValue");
        const rmrValueEl = document.getElementById("rmrValue");
        if (bmrValueEl)
            bmrValueEl.textContent = isFinite(bmr) ? bmr.toFixed(0) : '--';
        if (rmrValueEl)
            rmrValueEl.textContent = isFinite(rmr) ? rmr.toFixed(0) : '--';
        const whrEl = document.getElementById('waistToHipRatio');
        let whr = 0;
        if (whrEl && !whrEl.dataset.source) {
            whr = hip > 0 ? waist / hip : 0;
            whrEl.value = isFinite(whr) ? whr.toFixed(2) : '';
        }
        else if (whrEl) {
            whr = parseFloat(whrEl.value) || 0;
        }
        else {
            whr = hip > 0 ? waist / hip : 0;
        }
        // --- Update "Before" Column Gauges (Reflecting Current DOM State) ---
        updateBmiGauge(bmi, '');
        updateWaistCircumferenceGauge(waist, gender);
        updateHipCircumferenceGauge(hip);
        updateWHRGauge(whr, gender);
        if (!reportDataAfter) {
            calculateVisceralFat(); // This calculates and updates its own gauge based on DOM
        }
        updateVerticalBloodPressure(document.getElementById("bpSystolic").value, document.getElementById("bpDiastolic").value);
        const currentVisceralFat = parseFloat(document.getElementById('visceralFat').value) || 0;
        let currentBodyAge = bodyAgeDataBefore.source === 'file' && !reportDataAfter
            ? bodyAgeDataBefore.value
            : calculateBodyAge(age, gender, bmi, rhr, currentVisceralFat, bpSystolic);
        updateBodyAgeDisplay(currentBodyAge, age, '');
        // --- Handle Before vs. After Comparison ---
        const bmiPointsPanel = document.getElementById('bmiPointsDroppedPanel');
        const afterBodyAgeContainers = document.querySelectorAll('.comparison-after-body-age');
        const yearsGainedPanel = document.getElementById('yearsGainedBackPanel');
        const afterContainers = document.querySelectorAll('.comparison-after');
        if (reportDataBefore && reportDataAfter) {
            afterContainers.forEach(c => c.style.display = 'block');
            afterBodyAgeContainers.forEach(c => c.style.display = 'block');
            // --- Get "Before" metrics from report for accurate comparison ---
            const beforeWeight = reportDataBefore['Total Weight'] ? parseFloat(String(reportDataBefore['Total Weight'])) : 0;
            const beforeWeightKg = beforeWeight * 0.453592;
            const comparisonBmi = heightInMeters > 0 ? beforeWeightKg / (heightInMeters * heightInMeters) : 0;
            // === START FIX: Override "Before" column with correct data from reportDataBefore ===
            updateBmiGauge(comparisonBmi, '');
            const waistBefore = parseFloat(String(reportDataBefore['Waist (Abdominal)'] || reportDataBefore['Waist Circumference'] || 0));
            const hipBefore = parseFloat(String(reportDataBefore['Hip'] || reportDataBefore['Hip Circumference'] || 0));
            const whrBefore = hipBefore > 0 ? waistBefore / hipBefore : 0;
            updateWaistCircumferenceGauge(waistBefore, gender, '');
            updateHipCircumferenceGauge(hipBefore, '');
            updateWHRGauge(whrBefore, gender, '');
            const visceralFatBefore = reportDataBefore['Visceral Fat'] ? parseFloat(String(reportDataBefore['Visceral Fat'])) : 0;
            const visceralFatInput = document.getElementById('visceralFat');
            if (visceralFatInput) {
                visceralFatInput.value = isFinite(visceralFatBefore) ? visceralFatBefore.toFixed(1) : '';
            }
            updateVisceralFatGauge(visceralFatBefore, '');
            // === END FIX ===
            // --- Get "After" metrics from report ---
            const weightAfter = reportDataAfter['Total Weight'] ? parseFloat(String(reportDataAfter['Total Weight'])) : 0;
            const weightAfterKg = weightAfter * 0.453592;
            const bmiAfter = heightInMeters > 0 ? weightAfterKg / (heightInMeters * heightInMeters) : 0;
            // BMI Comparison
            updateBmiGauge(bmiAfter, '_after', comparisonBmi);
            const difference = comparisonBmi - bmiAfter;
            if (bmiPointsPanel) {
                bmiPointsPanel.style.display = 'block';
                bmiPointsPanel.classList.remove('gained', 'lost');
                if (difference > 0.05) {
                    bmiPointsPanel.classList.add('gained');
                    bmiPointsPanel.innerHTML = `<div class="value">${difference.toFixed(1)}</div><div class="label">BMI Points Dropped!</div>`;
                }
                else if (difference < -0.05) {
                    bmiPointsPanel.classList.add('lost');
                    bmiPointsPanel.innerHTML = `<div class="value">${Math.abs(difference).toFixed(1)}</div><div class="label">BMI Points Gained</div>`;
                }
                else {
                    bmiPointsPanel.innerHTML = `<div class="value">0</div><div class="label">BMI Unchanged</div>`;
                }
            }
            // Body Age Comparison
            const beforeAgeString = String(reportDataBefore['Customer Age'] || reportDataBefore['Age'] || '');
            const beforeAge = beforeAgeString ? parseInt(beforeAgeString, 10) : age;
            const beforeGenderString = String(reportDataBefore['Customer Gender'] || reportDataBefore['Gender'] || '');
            const beforeGender = beforeGenderString ? (/^f/i.test(beforeGenderString) ? 'F' : 'M') : gender;
            let comparisonBodyAge;
            if (bodyAgeDataBefore.source === 'file' && bodyAgeDataBefore.value !== null) {
                comparisonBodyAge = bodyAgeDataBefore.value;
            }
            else {
                const beforeVisceralFat = reportDataBefore['Visceral Fat'] ? parseFloat(String(reportDataBefore['Visceral Fat'])) : 0;
                const rhrForCalc = (_a = beforeRhr) !== null && _a !== void 0 ? _a : rhr;
                const bpSystolicForCalc = (_b = beforeBpSystolic) !== null && _b !== void 0 ? _b : bpSystolic;
                comparisonBodyAge = calculateBodyAge(beforeAge, beforeGender, comparisonBmi, rhrForCalc, beforeVisceralFat, bpSystolicForCalc);
            }
            updateBodyAgeDisplay(comparisonBodyAge, beforeAge, '');
            let bodyAgeAfterValue;
            const visceralFatAfter = reportDataAfter['Visceral Fat'] ? parseFloat(reportDataAfter['Visceral Fat']) : 0;
            if (reportDataAfter['Body Age'] && isFinite(reportDataAfter['Body Age'])) {
                bodyAgeAfterValue = reportDataAfter['Body Age'];
            }
            else {
                bodyAgeAfterValue = calculateBodyAge(age, gender, bmiAfter, rhr, visceralFatAfter, bpSystolic);
            }
            updateBodyAgeDisplay(bodyAgeAfterValue, age, '_after');
            updateYearsGainedBackDisplay(comparisonBodyAge, bodyAgeAfterValue);
            // Shape Ratios Comparison
            const waistAfter = parseFloat(String(reportDataAfter['Waist (Abdominal)'] || reportDataAfter['Waist Circumference'] || 0));
            const hipAfter = parseFloat(String(reportDataAfter['Hip'] || reportDataAfter['Hip Circumference'] || 0));
            const whrAfter = hipAfter > 0 ? waistAfter / hipAfter : 0;
            updateWaistCircumferenceGauge(waistAfter, gender, '_after');
            updateHipCircumferenceGauge(hipAfter, '_after');
            updateWHRGauge(whrAfter, gender, '_after');
            // Visceral Fat Comparison
            const visceralFatAfterInput = document.getElementById('visceralFat_after');
            if (visceralFatAfterInput) {
                visceralFatAfterInput.value = isFinite(visceralFatAfter) ? visceralFatAfter.toFixed(1) : '';
            }
            updateVisceralFatGauge(visceralFatAfter, '_after');
        }
        else {
            // Hide all "After" columns if there's no "After" data
            afterContainers.forEach(c => c.style.display = 'none');
            afterBodyAgeContainers.forEach(c => c.style.display = 'none');
            if (yearsGainedPanel)
                yearsGainedPanel.style.display = 'none';
            if (bmiPointsPanel)
                bmiPointsPanel.style.display = 'none';
        }
        updateHealthRiskGauge();
    }
    function updateVisceralFatGauge(value, suffix = '') {
        const marker = document.getElementById("visceralFatMarker" + suffix);
        const valueEl = document.getElementById("visceralFatValue" + suffix);
        const displayValueEl = document.getElementById("visceralFatDisplayValue" + suffix);
        if (!marker || !valueEl)
            return;
        const min = 0, max = 15;
        const v = parseFloat(String(value));
        if (isFinite(v)) {
            let pct = Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
            marker.style.left = `${pct}%`;
            valueEl.style.left = `${pct}%`;
            valueEl.textContent = v.toFixed(1) + " lbs";
            marker.style.display = 'block';
            valueEl.style.display = 'block';
            if (displayValueEl) {
                displayValueEl.textContent = v.toFixed(1);
            }
        }
        else {
            marker.style.display = 'none';
            valueEl.style.display = 'none';
            if (displayValueEl) {
                displayValueEl.textContent = '--';
            }
        }
    }
    function calculateVisceralFat() {
        var _a;
        const visceralFatInput = document.getElementById('visceralFat');
        if (!visceralFatInput)
            return;
        if (visceralFatInput.dataset.source === 'csv' || visceralFatInput.dataset.source === 'pdf') {
            updateVisceralFatGauge(visceralFatInput.value);
            return;
        }
        // Since bodyFat input is removed, we must rely on report data.
        const currentReportData = reportDataAfter || reportDataBefore;
        const bodyFatPercent = currentReportData ? parseFloat(String(currentReportData['Body Fat %'] || '0')) : 0;
        const weight = parseFloat(document.getElementById('weight').value);
        const genderVal = ((_a = document.getElementById('gender')) === null || _a === void 0 ? void 0 : _a.value) || "M";
        let calculatedVisceralFatForBar = '';
        if (!isNaN(weight) && bodyFatPercent > 0) {
            const visceralFatValue = (genderVal === "M" ? 0.15 : 0.12) * weight * (bodyFatPercent / 100);
            visceralFatInput.value = visceralFatValue.toFixed(1);
            calculatedVisceralFatForBar = visceralFatValue;
        }
        else {
            visceralFatInput.value = '';
        }
        updateVisceralFatGauge(calculatedVisceralFatForBar);
    }
    function animateValue(element, start, end, duration, decimals = 0) {
        if (start === end) {
            element.textContent = end.toFixed(decimals);
            return;
        }
        const range = end - start;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime)
                startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const current = progress * range + start;
            element.textContent = current.toFixed(decimals);
            if (progress < 1) {
                requestAnimationFrame(step);
            }
            else {
                element.textContent = end.toFixed(decimals);
            }
        };
        requestAnimationFrame(step);
    }
    function updateBodyAgeDisplay(bodyAge, actualAge, suffix = '') {
        const valueEl = document.getElementById(`bodyAgeDisplayValue${suffix}`);
        const containerEl = valueEl ? valueEl.parentElement : null;
        const warningMessage = document.getElementById(`bodyAgeWarningMessage${suffix}`);
        if (!containerEl || !valueEl || !warningMessage)
            return;
        let lastDisplayed = suffix === '_after' ? lastDisplayedBodyAgeAfter : lastDisplayedBodyAge;
        if (bodyAge !== null && isFinite(bodyAge)) {
            const startValue = lastDisplayed !== null && isFinite(lastDisplayed) ? lastDisplayed : Math.max(0, bodyAge - 20);
            animateValue(valueEl, startValue, bodyAge, 800);
            lastDisplayed = bodyAge;
            if (actualAge > 0 && bodyAge > actualAge) {
                containerEl.classList.add('warning');
                warningMessage.style.display = 'block';
                warningMessage.textContent = `This is ${bodyAge - actualAge} years older than your actual age.`;
            }
            else {
                containerEl.classList.remove('warning');
                warningMessage.style.display = 'none';
                warningMessage.textContent = '';
            }
        }
        else {
            valueEl.textContent = '--';
            lastDisplayed = null;
            containerEl.classList.remove('warning');
            warningMessage.style.display = 'none';
            warningMessage.textContent = '';
        }
        if (suffix === '_after') {
            lastDisplayedBodyAgeAfter = lastDisplayed;
        }
        else {
            lastDisplayedBodyAge = lastDisplayed;
        }
    }
    function updateYearsGainedBackDisplay(beforeAge, afterAge) {
        const panel = document.getElementById('yearsGainedBackPanel');
        if (!panel)
            return;
        if (beforeAge === null || afterAge === null || !isFinite(beforeAge) || !isFinite(afterAge)) {
            panel.style.display = 'none';
            return;
        }
        const difference = beforeAge - afterAge;
        panel.style.display = 'block';
        panel.classList.remove('gained', 'lost');
        if (difference > 0) {
            panel.classList.add('gained');
            panel.innerHTML = `<div class="value">${difference.toFixed(1)}</div><div class="label">Years Gained Back!</div>`;
        }
        else if (difference < 0) {
            panel.classList.add('lost');
            panel.innerHTML = `<div class="value">${Math.abs(difference).toFixed(1)}</div><div class="label">Years Older</div>`;
        }
        else {
            panel.innerHTML = `<div class="value">0</div><div class="label">Body Age Unchanged</div>`;
        }
    }
    function updateWaistCircumferenceGauge(waist, gender, suffix = '') {
        const bar = document.getElementById("waistCircBar" + suffix);
        const marker = document.getElementById("waistCircMarker" + suffix);
        const valueEl = document.getElementById("waistCircValue" + suffix);
        const riskLabel = document.getElementById("waistCircRiskLabel" + suffix);
        if (!bar || !marker || !valueEl || !riskLabel)
            return;
        const v = waist;
        if (!isFinite(v) || v <= 0) {
            marker.style.display = 'none';
            valueEl.style.display = 'none';
            riskLabel.textContent = '';
            return;
        }
        marker.style.display = 'block';
        valueEl.style.display = 'block';
        const riskThreshold = gender === 'M' ? 40 : 35;
        const min = 20, max = 60;
        const pct = Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
        const riskPct = Math.max(0, Math.min(100, (riskThreshold - min) / (max - min) * 100));
        marker.style.left = `${pct}%`;
        valueEl.style.left = `${pct}%`;
        valueEl.textContent = v.toFixed(1) + " in";
        bar.style.background = `linear-gradient(to right, var(--healthy-green) ${riskPct}%, var(--danger-red) ${riskPct}%)`;
        if (riskLabel)
            riskLabel.textContent = `High Risk (>${riskThreshold} in)`;
    }
    function updateHipCircumferenceGauge(hip, suffix = '') {
        const bar = document.getElementById("hipCircBar" + suffix);
        const marker = document.getElementById("hipCircMarker" + suffix);
        const valueEl = document.getElementById("hipCircValue" + suffix);
        if (!bar || !marker || !valueEl)
            return;
        const v = hip;
        if (!isFinite(v) || v <= 0) {
            marker.style.display = 'none';
            valueEl.style.display = 'none';
            return;
        }
        marker.style.display = 'block';
        valueEl.style.display = 'block';
        const min = 25, max = 65;
        const pct = Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
        marker.style.left = `${pct}%`;
        valueEl.style.left = `${pct}%`;
        valueEl.textContent = v.toFixed(1) + " in";
    }
    function updateWHRGauge(whr, gender, suffix = '') {
        const needle = document.getElementById('whrNeedle' + suffix);
        const valueEl = document.getElementById('whrGaugeValue' + suffix);
        const labelEl = document.getElementById('whrGaugeLabel' + suffix);
        const pathLow = document.getElementById('whrGaugeLow' + suffix);
        const pathMod = document.getElementById('whrGaugeMod' + suffix);
        const pathHigh = document.getElementById('whrGaugeHigh' + suffix);
        if (!needle || !valueEl || !labelEl || !pathLow || !pathMod || !pathHigh)
            return;
        const thresholds = gender === 'M'
            ? { low: 0.90, mod: 1.0 }
            : { low: 0.80, mod: 0.85 };
        const minWHR = 0.6, maxWHR = 1.2;
        const minAngle = -90, maxAngle = 90;
        let value = isFinite(whr) ? Math.max(minWHR, Math.min(maxWHR, whr)) : minWHR;
        const pct = (value - minWHR) / (maxWHR - minWHR);
        const angle = minAngle + pct * (maxAngle - minAngle);
        needle.style.transform = `rotate(${angle}deg)`;
        valueEl.textContent = isFinite(whr) ? whr.toFixed(2) : '--';
        let label = "";
        if (!isFinite(whr) || whr <= 0) {
            label = "";
        }
        else if (value < thresholds.low) {
            label = "Low Risk";
        }
        else if (value < thresholds.mod) {
            label = "Moderate Risk";
        }
        else {
            label = "High Risk";
        }
        labelEl.textContent = label;
        const range = maxAngle - minAngle;
        const p_low = (thresholds.low - minWHR) / (maxWHR - minWHR);
        const p_mod = (thresholds.mod - minWHR) / (maxWHR - minWHR);
        const arc = (p) => `M 5 50 A 45 45 0 0 1 ${50 + 45 * Math.sin((minAngle + p * range) * Math.PI / 180)} ${50 - 45 * Math.cos((minAngle + p * range) * Math.PI / 180)}`;
        pathLow.setAttribute('d', arc(p_low));
        pathMod.setAttribute('d', arc(p_mod));
        pathHigh.setAttribute('d', `M ${50 + 45 * Math.sin((minAngle + p_mod * range) * Math.PI / 180)} ${50 - 45 * Math.cos((minAngle + p_mod * range) * Math.PI / 180)} A 45 45 0 0 1 95 50`);
    }
    // --- CSV PARSING ---
    function populateFieldsFromCsv(data) {
        const el = (id) => document.getElementById(id);
        const num = (v) => { const n = parseFloat((v || '').toString().replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : ''; };
        const name = data['Customer Name'] || [data['Customer First Name'], data['Customer Last Name']].filter(Boolean).join(' ').trim();
        const gender = data['Customer Gender'] || data['Gender'];
        const age = data['Customer Age'] || data['Age'];
        let heightIn = '';
        const rawHeight = data['Customer Height'] || data['Height'];
        if (rawHeight) {
            if (/cm/i.test(rawHeight)) {
                heightIn = (Number(num(rawHeight)) / 2.54).toFixed(1);
            }
            else {
                heightIn = String(num(rawHeight));
            }
        }
        let weightLb = '';
        const rawWeight = data['Customer Weight'] || data['Weight'] || data['Total Weight'];
        if (rawWeight) {
            if (/kg/i.test(rawWeight)) {
                weightLb = (Number(num(rawWeight)) * 2.20462).toFixed(1);
            }
            else {
                weightLb = String(num(rawWeight));
            }
        }
        el('name').value = name || '';
        if (gender)
            document.getElementById('gender').value = (/^f/i.test(gender) ? 'F' : 'M');
        el('age').value = String(num(age));
        el('height').value = heightIn !== '' ? heightIn : '';
        el('weight').value = weightLb !== '' ? weightLb : '';
        const fieldMap = {
            'Visceral Fat': 'visceralFat',
            'Subcutaneous Fat': 'subcutaneousFat',
            'Android Mass': 'androidMass',
            'Gynoid Mass': 'gynoidMass',
            'Waist-to-Hip Ratio': 'waistToHipRatio',
        };
        Object.entries(fieldMap).forEach(([dataKey, elementId]) => {
            const val = num(data[dataKey]);
            const element = el(elementId);
            if (element) {
                if (val !== '') {
                    element.value = String(val);
                    element.dataset.source = 'csv';
                }
                else {
                    delete element.dataset.source;
                }
            }
        });
    }
    function setupCsvInput(inputId, targetArray) {
        const input = document.getElementById(inputId);
        if (!input)
            return;
        input.addEventListener('change', function (e) {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                var _a;
                let text = ((_a = ev.target) === null || _a === void 0 ? void 0 : _a.result) || '';
                if (text.charCodeAt(0) === 0xFEFF) { // BOM
                    text = text.substring(1);
                }
                function parseCSV(txt) {
                    const firstLine = txt.slice(0, txt.indexOf('\n'));
                    const commaCount = (firstLine.match(/,/g) || []).length;
                    const semicolonCount = (firstLine.match(/;/g) || []).length;
                    const delimiter = semicolonCount > commaCount ? ';' : ',';
                    const rows = [];
                    let i = 0, field = '', row = [], inQuotes = false;
                    txt = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    while (i < txt.length) {
                        const c = txt[i];
                        if (inQuotes) {
                            if (c === '"') {
                                if (txt[i + 1] === '"') {
                                    field += '"';
                                    i++;
                                }
                                else {
                                    inQuotes = false;
                                }
                            }
                            else {
                                field += c;
                            }
                        }
                        else {
                            if (c === '"') {
                                inQuotes = true;
                            }
                            else if (c === delimiter) {
                                row.push(field.trim());
                                field = '';
                            }
                            else if (c === '\n') {
                                row.push(field.trim());
                                rows.push(row);
                                row = [];
                                field = '';
                            }
                            else {
                                field += c;
                            }
                        }
                        i++;
                    }
                    if (field || row.length) {
                        row.push(field.trim());
                        rows.push(row);
                    }
                    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0]));
                }
                const allRows = parseCSV(text);
                if (!allRows.length)
                    return;
                let measurementsData = [];
                let rowsForLegacyParser = [];
                const circHeaderIndex = allRows.findIndex(row => (row[0] || '').trim().toUpperCase() === 'CIRCUMFERENCES & LENGTHS');
                let circEndIndex = -1;
                if (circHeaderIndex !== -1 && circHeaderIndex + 1 < allRows.length) {
                    const headers = allRows[circHeaderIndex + 1].map(h => (h || '').trim().toLowerCase());
                    const nameIndex = headers.indexOf('measurement name');
                    const valueIndex = headers.indexOf('value');
                    if (nameIndex !== -1 && valueIndex !== -1) {
                        let i = circHeaderIndex + 2;
                        for (; i < allRows.length; i++) {
                            const row = allRows[i];
                            if (!row || !row[nameIndex] || !row[valueIndex] || row[nameIndex].trim() === '') {
                                break;
                            }
                            measurementsData.push({
                                name: row[nameIndex].trim(),
                                value: row[valueIndex].trim()
                            });
                        }
                        circEndIndex = i;
                    }
                }
                if (circHeaderIndex !== -1 && circEndIndex > circHeaderIndex) {
                    rowsForLegacyParser = allRows.slice(0, circHeaderIndex).concat(allRows.slice(circEndIndex));
                }
                else {
                    rowsForLegacyParser = allRows;
                }
                const rows = rowsForLegacyParser;
                if (!rows.length)
                    return;
                const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
                const data = {};
                const headers = rows[0].map(h => norm(h));
                const dataRow = rows.length > 1 ? rows[1] : null;
                const commonHeaders = ['name', 'gender', 'age', 'weight', 'height', 'body fat', 'bmi'];
                let headerMatches = 0;
                for (const header of headers) {
                    if (commonHeaders.some(ch => header.includes(ch))) {
                        headerMatches++;
                    }
                }
                const headerMap = {
                    'customer name': 'Customer Name', 'name': 'Customer Name',
                    'customer first name': 'Customer First Name', 'customer last name': 'Customer Last Name',
                    'customer gender': 'Gender', 'gender': 'Gender',
                    'customer age': 'Age', 'age': 'Age',
                    'customer height': 'Customer Height', 'height': 'Customer Height',
                    'customer weight': 'Customer Weight', 'weight': 'Customer Weight', 'total weight': 'Total Weight',
                    'body fat %': 'Body Fat %', 'body fat percent': 'Body Fat %', 'body fat': 'Body Fat %',
                    'lean mass': 'Lean Mass', 'bone mass': 'Bone Mass', 'fat mass': 'Fat Mass',
                    'body mass index (bmi)': 'BMI', 'bmi': 'BMI',
                    'visceral fat': 'Visceral Fat',
                    'subcutaneous fat': 'Subcutaneous Fat',
                    'android mass': 'Android Mass',
                    'gynoid mass': 'Gynoid Mass',
                    'body age': 'Body Age', 'metabolic age': 'Metabolic Age',
                    'waist circumference': 'Waist Circumference', 'waist (abdominal)': 'Waist Circumference',
                    'hip circumference': 'Hip Circumference', 'hip': 'Hip Circumference',
                    'waist-hip ratio (who)': 'Waist-to-Hip Ratio'
                };
                if (headerMatches > 3 && dataRow) { // Row-based CSV
                    headers.forEach((header, index) => {
                        const mappedKey = headerMap[header];
                        if (mappedKey && dataRow[index] !== undefined) {
                            data[mappedKey] = dataRow[index];
                        }
                    });
                }
                else { // Key-Value CSV
                    rows.forEach(r => {
                        if (r[0] && r[1] !== undefined) {
                            const rawKey = r[0].trim();
                            const normalizedKey = norm(rawKey);
                            const mappedKey = headerMap[normalizedKey];
                            if (mappedKey) {
                                data[mappedKey] = r[1].trim();
                            }
                            else {
                                data[rawKey] = r[1].trim();
                            }
                        }
                    });
                }
                const num = (v) => { const n = parseFloat((v || '').toString().replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : ''; };
                if (targetArray === 'before') {
                    measurementsBefore = measurementsData;
                    reportDataBefore = data;
                    measurementsAfter = [];
                    reportDataAfter = null;
                    document.getElementById('stykuCSV_after').value = '';
                    populateFieldsFromCsv(data);
                    const bodyAgeFromFile = num(data['Body Age'] || data['Metabolic Age']);
                    if (bodyAgeFromFile !== '') {
                        bodyAgeDataBefore.value = Number(bodyAgeFromFile);
                        bodyAgeDataBefore.source = 'file';
                    }
                    else {
                        bodyAgeDataBefore.source = 'calculated';
                    }
                }
                else { // 'after'
                    if (reportDataBefore || measurementsBefore.length > 0) {
                        beforeRhr = parseFloat(document.getElementById("restingHeartRate").value) || null;
                        beforeBpSystolic = parseFloat(document.getElementById('bpSystolic').value) || null;
                        beforeBpDiastolic = parseFloat(document.getElementById('bpDiastolic').value) || null;
                        measurementsAfter = measurementsData;
                        reportDataAfter = data;
                        populateFieldsFromCsv(data); // Update top panel with "After" data
                    }
                    else {
                        measurementsBefore = measurementsData;
                        reportDataBefore = data;
                        measurementsAfter = [];
                        reportDataAfter = null;
                        populateFieldsFromCsv(data);
                        const bodyAgeFromFile = num(data['Body Age'] || data['Metabolic Age']);
                        if (bodyAgeFromFile !== '') {
                            bodyAgeDataBefore.value = Number(bodyAgeFromFile);
                            bodyAgeDataBefore.source = 'file';
                        }
                        else {
                            bodyAgeDataBefore.source = 'calculated';
                        }
                        e.target.value = ''; // Clear the after input
                    }
                }
                renderPdfInsights();
                updateCalculatedFields();
            };
            reader.readAsText(file);
        });
    }
    setupCsvInput('stykuCSV', 'before');
    setupCsvInput('stykuCSV_after', 'after');
    // --- PDF PARSING & RENDERING ---
    let overlays = [];
    let nextOverlayId = 0;
    const comparisonColors = [
        'rgba(239, 68, 68, 0.7)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(59, 130, 246, 0.7)',
        'rgba(245, 158, 11, 0.7)',
        'rgba(139, 92, 246, 0.7)',
        'rgba(236, 72, 153, 0.7)', // Pink
    ];
    async function getTintedImage(imgSrc, color) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error("Could not get canvas context."));
                }
                ctx.drawImage(img, 0, 0);
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const threshold = 240;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                            data[i + 3] = 0; // Make transparent
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
                catch (e) {
                    console.error("Could not process image data for transparency:", e);
                }
                ctx.globalCompositeOperation = 'source-in';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                resolve(canvas);
            };
            img.onerror = () => reject(new Error(`Failed to load image from src: ${imgSrc.substring(0, 100)}...`));
            img.src = imgSrc;
        });
    }
    async function drawOverlays() {
        const silhouetteCanvas = document.getElementById('silhouetteOverlayCanvas');
        const profileCanvas = document.getElementById('profileOverlayCanvas');
        if (!silhouetteCanvas || !profileCanvas)
            return;
        const silhouetteCtx = silhouetteCanvas.getContext('2d');
        const profileCtx = profileCanvas.getContext('2d');
        if (!silhouetteCtx || !profileCtx)
            return;
        silhouetteCtx.clearRect(0, 0, silhouetteCanvas.width, silhouetteCanvas.height);
        profileCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
        // Draw the tinted silhouettes
        for (const [index, overlay] of overlays.entries()) {
            if (overlay.isVisible) {
                const color = comparisonColors[index % comparisonColors.length];
                if (overlay.silhouetteImage) {
                    try {
                        const tintedSilhouette = await getTintedImage(overlay.silhouetteImage, color);
                        silhouetteCtx.drawImage(tintedSilhouette, 0, 0, silhouetteCanvas.width, silhouetteCanvas.height);
                    }
                    catch (error) {
                        console.error(`Failed to process silhouette image for ${overlay.fileName}:`, error);
                    }
                }
                if (overlay.profileImage) {
                    try {
                        const tintedProfile = await getTintedImage(overlay.profileImage, color);
                        profileCtx.drawImage(tintedProfile, 0, 0, profileCanvas.width, profileCanvas.height);
                    }
                    catch (error) {
                        console.error(`Failed to process profile image for ${overlay.fileName}:`, error);
                    }
                }
            }
        }
    }
    function renderOverlayList() {
        const listEl = document.getElementById('silhouetteList');
        if (!listEl)
            return;
        const controlsEl = listEl.parentElement;
        if (controlsEl) {
            controlsEl.style.display = overlays.length > 0 ? 'block' : 'none';
        }
        listEl.innerHTML = '';
        overlays.forEach((overlay, index) => {
            const item = document.createElement('div');
            item.className = 'silhouette-item';
            const color = comparisonColors[index % comparisonColors.length];
            item.innerHTML = `
                <span class="color-swatch" style="background-color: ${color};"></span>
                <label>
                  <input type="checkbox" class="visibility-toggle" ${overlay.isVisible ? 'checked' : ''}>
                  <span class="file-name" title="${overlay.fileName}">${overlay.fileName}</span>
                </label>
                <button class="delete-btn" title="Remove Overlay">&times;</button>
            `;
            const checkbox = item.querySelector('.visibility-toggle');
            checkbox.addEventListener('change', () => {
                overlay.isVisible = checkbox.checked;
                drawOverlays();
            });
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => {
                overlays = overlays.filter(o => o.id !== overlay.id);
                renderOverlayList();
                drawOverlays();
            });
            listEl.appendChild(item);
        });
    }
    const stykuPdfInput = document.getElementById('stykuPDF');
    if (stykuPdfInput) {
        stykuPdfInput.addEventListener('change', async (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!file)
                return;
            try {
                const fileBuffer = await file.arrayBuffer();
                const pdfData = new Uint8Array(fileBuffer);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                reportDataBefore = await parsePdfReport(pdf);
                // Reset after data if a new before is uploaded
                reportDataAfter = null;
                document.getElementById('stykuPDF_after').value = '';
                measurementsAfter = [];
                document.getElementById('stykuCSV_after').value = '';
                measurementsBefore = reportDataBefore.measurements || [];
                overlays = overlays.filter(o => o.id !== -1); // Remove old main report
                if (reportDataBefore.silhouetteImage || reportDataBefore.profileImage) {
                    overlays.unshift({
                        id: -1,
                        fileName: `Before - ${file.name}`,
                        silhouetteImage: reportDataBefore.silhouetteImage || null,
                        profileImage: reportDataBefore.profileImage || null,
                        isVisible: true,
                    });
                }
                renderOverlayList();
                drawOverlays();
                populateFieldsFromPdf(reportDataBefore);
                renderPdfInsights();
                updateCalculatedFields();
            }
            catch (error) {
                console.error("Failed to parse PDF:", error);
                alert("Could not process the PDF file. It might be corrupted or in an unexpected format.");
            }
        });
    }
    const stykuPdfAfterInput = document.getElementById('stykuPDF_after');
    if (stykuPdfAfterInput) {
        stykuPdfAfterInput.addEventListener('change', async (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!file)
                return;
            try {
                const fileBuffer = await file.arrayBuffer();
                const pdfData = new Uint8Array(fileBuffer);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                const parsedData = await parsePdfReport(pdf);
                if (!reportDataBefore) {
                    // No 'before' data exists, so treat this as the 'before' file
                    reportDataBefore = parsedData;
                    measurementsBefore = parsedData.measurements || [];
                    reportDataAfter = null;
                    measurementsAfter = [];
                    overlays = overlays.filter(o => o.id !== -1 && o.id !== -2);
                    if (reportDataBefore.silhouetteImage || reportDataBefore.profileImage) {
                        overlays.unshift({
                            id: -1,
                            fileName: `Before - ${file.name}`,
                            silhouetteImage: reportDataBefore.silhouetteImage,
                            profileImage: reportDataBefore.profileImage,
                            isVisible: true,
                        });
                    }
                    populateFieldsFromPdf(reportDataBefore);
                    e.target.value = '';
                }
                else {
                    beforeRhr = parseFloat(document.getElementById("restingHeartRate").value) || null;
                    beforeBpSystolic = parseFloat(document.getElementById('bpSystolic').value) || null;
                    beforeBpDiastolic = parseFloat(document.getElementById('bpDiastolic').value) || null;
                    // 'before' data exists, so treat this as the 'after' file
                    reportDataAfter = parsedData;
                    measurementsAfter = parsedData.measurements || [];
                    overlays = overlays.filter(o => o.id !== -2); // Remove old "after" report
                    if (reportDataAfter.silhouetteImage || reportDataAfter.profileImage) {
                        overlays.push({
                            id: -2,
                            fileName: `After - ${file.name}`,
                            silhouetteImage: reportDataAfter.silhouetteImage,
                            profileImage: reportDataAfter.profileImage,
                            isVisible: true,
                        });
                    }
                    // Also update the main panel with the "After" data for viewing
                    populateFieldsFromPdf(reportDataAfter);
                }
                renderOverlayList();
                drawOverlays();
                renderPdfInsights();
                updateCalculatedFields();
            }
            catch (error) {
                console.error("Failed to parse 'After' PDF:", error);
                alert("Could not process the 'After' PDF file. It might be corrupted or in an unexpected format.");
            }
        });
    }
    async function extractImagesFromPage(page) {
        const operatorList = await page.getOperatorList();
        const { OPS } = pdfjsLib;
        const images = [];
        for (let i = 0; i < operatorList.fnArray.length; i++) {
            if (operatorList.fnArray[i] !== OPS.paintImageXObject) {
                continue;
            }
            const imgName = operatorList.argsArray[i][0];
            try {
                const img = await page.objs.get(imgName);
                if (!img || !img.data)
                    continue;
                const { width, height, data } = img;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx)
                    continue;
                const imgData = ctx.createImageData(width, height);
                let pixels = imgData.data;
                let count = 0;
                if (data.length === width * height * 3) { // RGB
                    for (let j = 0; j < data.length; j += 3) {
                        pixels[count++] = data[j];
                        pixels[count++] = data[j + 1];
                        pixels[count++] = data[j + 2];
                        pixels[count++] = 255;
                    }
                }
                else if (data.length === width * height) { // Grayscale
                    for (let j = 0; j < data.length; j++) {
                        const gray = data[j];
                        pixels[count++] = gray;
                        pixels[count++] = gray;
                        pixels[count++] = gray;
                        pixels[count++] = 255;
                    }
                }
                else {
                    console.warn(`Unsupported image format in PDF for image ${imgName}.`);
                    continue;
                }
                ctx.putImageData(imgData, 0, 0);
                images.push(canvas.toDataURL('image/png'));
            }
            catch (e) {
                console.warn(`Could not process image ${imgName} from PDF. It may be unresolved or in an unsupported format.`, e);
            }
        }
        return images;
    }
    async function parsePdfReport(pdf) {
        var _a, _b, _c, _d, _e, _f, _g;
        const data = { measurements: [] };
        const extractValue = (text, label) => {
            var _a;
            const regex = new RegExp(`${label.replace(/[\(\)]/g, '\\$&').replace('%', '\\%')}\\s+([\\d.]+)`);
            const match = text.match(regex);
            return ((_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : undefined) ? parseFloat(match[1]) : undefined;
        };
        const page1Text = await pdf.getPage(1).then((p) => p.getTextContent()).then((tc) => tc.items.map((i) => i.str).join(' '));
        const page2Text = pdf.numPages >= 2 ? await pdf.getPage(2).then((p) => p.getTextContent()).then((tc) => tc.items.map((i) => i.str).join(' ')) : '';
        const page8Text = pdf.numPages >= 8 ? await pdf.getPage(8).then((p) => p.getTextContent()).then((tc) => tc.items.map((i) => i.str).join(' ')) : '';
        const page11Text = pdf.numPages >= 11 ? await pdf.getPage(11).then((p) => p.getTextContent()).then((tc) => tc.items.map((i) => i.str).join(' ')) : '';
        const page12Text = pdf.numPages >= 12 ? await pdf.getPage(12).then((p) => p.getTextContent()).then((tc) => tc.items.map((i) => i.str).join(' ')) : '';
        data['Total Weight'] = extractValue(page1Text, 'Height & Weight\\s*\\d+\\s*ft\\s*\\d+\\s*in\\s*&');
        if (!data['Total Weight']) {
            const weightMatch = page1Text.match(/(\d+\.?\d*)\s*lbs/);
            if (weightMatch)
                data['Total Weight'] = parseFloat(weightMatch[1]);
        }
        const metricsToParse = ['Body Fat %', 'Fat Mass', 'Lean Mass', 'Bone Mass', 'Android Mass', 'Gynoid Mass', 'Visceral Fat', 'Subcutaneous Fat', 'Body Age'];
        metricsToParse.forEach(metric => {
            var _a;
            const value = (_a = extractValue(page2Text, metric)) !== null && _a !== void 0 ? _a : extractValue(page1Text, metric);
            if (value !== undefined)
                data[metric] = value;
        });
        if (pdf.numPages >= 2) {
            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const items = textContent.items;
            // Group items into lines based on Y-coordinate
            const lines = {};
            items.forEach((item) => {
                const y = Math.round(item.transform[5]);
                if (!lines[y]) {
                    lines[y] = [];
                }
                lines[y].push(item);
            });
            // Sort lines from top to bottom
            const sortedLines = Object.values(lines).sort((a, b) => b[0].transform[5] - a[0].transform[5]);
            const measurements = [];
            const pageMidX = page.view[2] / 2;
            const measurementBlocklist = [
                'body fat',
                'lean mass',
                'bone mass',
                'fat mass',
                'android mass',
                'gynoid mass',
                'visceral fat',
                'subcutaneous fat',
                'bmi',
                'body mass index'
            ];
            sortedLines.forEach((lineItems) => {
                // For each line, sort items from left to right
                lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                const leftPart = [];
                const rightPart = [];
                lineItems.forEach(item => {
                    const itemStr = item.str.trim().toLowerCase();
                    // Filter out units early, but also handle cases like "in."
                    if (itemStr === 'in' || itemStr === 'cm' || itemStr === 'in.' || itemStr === 'cm.')
                        return;
                    if (item.transform[4] < pageMidX) {
                        leftPart.push(item);
                    }
                    else {
                        rightPart.push(item);
                    }
                });
                const processPart = (partItems) => {
                    if (partItems.length < 2)
                        return;
                    const labelParts = [];
                    let valuePart = null;
                    // Find the last item that looks like a number, that's our value.
                    // Iterate backwards to find the value first.
                    for (let i = partItems.length - 1; i >= 0; i--) {
                        const currentItem = partItems[i];
                        const potentialValue = currentItem.str.trim();
                        if (!valuePart && /^\d+(\.\d+)?$/.test(potentialValue)) {
                            valuePart = potentialValue;
                        }
                        else {
                            // If we've already found the value, or if this item is not the value,
                            // it must be part of the label.
                            labelParts.unshift(currentItem.str.trim());
                        }
                    }
                    if (valuePart && labelParts.length > 0) {
                        const name = labelParts.join(' ').replace(/\s+/g, ' ').trim();
                        const normalizedName = name.toLowerCase().replace(/%/g, '').trim();
                        if (name.length > 2 &&
                            !/page|scan date|measurement|styku/i.test(name) &&
                            !measurementBlocklist.some(blocked => normalizedName.startsWith(blocked))) {
                            measurements.push({ name, value: valuePart });
                        }
                    }
                };
                processPart(leftPart);
                processPart(rightPart);
            });
            // Remove duplicates which might occur
            const uniqueMeasurements = [];
            const seenNames = new Set();
            measurements.forEach(m => {
                if (!seenNames.has(m.name)) {
                    uniqueMeasurements.push(m);
                    seenNames.add(m.name);
                }
            });
            data.measurements = uniqueMeasurements;
        }
        // Explicitly find key circumferences from the parsed measurements table as a primary source.
        const waistMatch = data.measurements.find((m) => /waist/i.test(m.name));
        if (waistMatch) {
            data['Waist (Abdominal)'] = parseFloat(waistMatch.value);
        }
        const hipMatchFromMeasurements = data.measurements.find((m) => /hip/i.test(m.name));
        if (hipMatchFromMeasurements) {
            data['Hip'] = parseFloat(hipMatchFromMeasurements.value);
        }
        if (pdf.numPages >= 3) {
            const page = await pdf.getPage(3);
            const images = await extractImagesFromPage(page);
            if (images.length >= 2) {
                data.silhouetteImage = images[0];
                data.profileImage = images[1];
            }
        }
        data['BodyCompSummary'] = (_b = (_a = page8Text.match(/Your body is made up of ([\d.\s\w,]+)\./)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : undefined;
        // More robustly parse Rank and Comparison data from page 8 text
        const rankMatch = page8Text.match(/Your Rank\s+([\d.]+)%/i);
        if (rankMatch) {
            data['RankValue'] = rankMatch[1];
            const rankLabelMatch = page8Text.match(/places you on the "([\w\s]+)" level/i);
            if (rankLabelMatch) {
                data['RankLabel'] = rankLabelMatch[1];
            }
        }
        const compareMatch = page8Text.match(/lower body fat than ([\d.]+)% of (women|men)/i);
        if (compareMatch) {
            data['CompareValue'] = compareMatch[1];
            // Try to find the full summary sentence
            const compareSummaryMatch = page8Text.match(/(You have a lower body fat than [^.]*\.)/i);
            if (compareSummaryMatch) {
                data['CompareSummary'] = compareSummaryMatch[0];
            }
            else {
                // Fallback if the full sentence structure varies
                data['CompareSummary'] = `You have a lower body fat than ${compareMatch[1]}% of ${compareMatch[2]}.`;
            }
        }
        const waistValueMatch = page11Text.match(/Your waist measures ([\d.]+) inches/s);
        if (waistValueMatch) {
            data['Waist (Abdominal)'] = parseFloat(waistValueMatch[1]);
        }
        // More robust disease risk parsing
        const fullRiskText = page12Text + " " + page1Text;
        const extractRisk = (text, disease) => {
            var _a;
            const diseasePattern = disease.replace(/\s+/g, '\\s*');
            const regex = new RegExp(`([\\d.]+)x\\s*More likely to suffer from\\s*${diseasePattern}`, 'i');
            const match = text.match(regex);
            return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : undefined;
        };
        data['CancerRisk'] = extractRisk(fullRiskText, 'Cancer');
        data['CardioRisk'] = extractRisk(fullRiskText, 'Cardiovascular Disease');
        data['RespiratoryRisk'] = extractRisk(fullRiskText, 'Respiratory Disease');
        data['OtherRisk'] = extractRisk(fullRiskText, 'All Other Diseases');
        return data;
    }
    function populateFieldsFromPdf(data) {
        const el = (id) => document.getElementById(id);
        const setVal = (id, val, source = 'pdf') => {
            const element = el(id);
            if (element && val != null && isFinite(val)) {
                element.value = String(val);
                element.dataset.source = source;
            }
            else if (element) {
                // Clear the value if the data is not valid to prevent stale data
                element.value = '';
                delete element.dataset.source;
            }
        };
        // Populate basic demographics that might be in the PDF
        const rawWeight = data['Total Weight'];
        if (rawWeight) {
            el('weight').value = String(parseFloat(rawWeight).toFixed(1));
        }
        const fieldMap = {
            'Visceral Fat': 'visceralFat',
            'Subcutaneous Fat': 'subcutaneousFat',
            'Android Mass': 'androidMass',
            'Gynoid Mass': 'gynoidMass',
        };
        Object.entries(fieldMap).forEach(([dataKey, elementId]) => {
            setVal(elementId, data[dataKey]);
        });
        // This function is now only responsible for populating the DOM.
        // The logic for setting bodyAgeDataBefore is handled in the event listener
        // to prevent overwriting "before" data when an "after" pdf is loaded.
        if (reportDataAfter === null && data['Body Age'] && isFinite(data['Body Age'])) {
            bodyAgeDataBefore.value = data['Body Age'];
            bodyAgeDataBefore.source = 'file';
        }
        else if (reportDataAfter === null) {
            bodyAgeDataBefore.source = 'calculated';
        }
    }
    function getRankCategory(fatPct) {
        if (!isFinite(fatPct))
            return "";
        if (fatPct < 16)
            return "Essential";
        if (fatPct < 23)
            return "Athletic";
        if (fatPct < 35)
            return "Fit";
        if (fatPct < 40)
            return "Average";
        return "At Risk";
    }
    function createDonutChart(container, chartData, centerText) {
        if (!container)
            return;
        container.innerHTML = '';
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 42 42');
        svg.classList.add('donut-chart-svg');
        const legend = document.createElement('div');
        legend.classList.add('chart-legend');
        const radius = 15.9154943092;
        const circumference = 100;
        let totalPercent = 0;
        const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
        if (totalValue === 0)
            return;
        chartData.forEach((item, index) => {
            const percent = (item.value / totalValue) * 100;
            if (percent === 0)
                return;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('r', String(radius));
            circle.setAttribute('cx', '21');
            circle.setAttribute('cy', '21');
            circle.setAttribute('fill', 'transparent');
            circle.setAttribute('stroke', item.color);
            circle.setAttribute('stroke-width', '8');
            circle.setAttribute('stroke-dasharray', `${percent} ${circumference - percent}`);
            circle.setAttribute('stroke-dashoffset', String(-totalPercent));
            circle.classList.add('donut-segment');
            svg.appendChild(circle);
            totalPercent += percent;
            const legendItem = document.createElement('div');
            legendItem.classList.add('legend-item');
            legendItem.innerHTML = `
                <div class="legend-color-box" style="background-color: ${item.color};"></div>
                <div class="legend-details">
                    <div class="legend-label">${item.label}</div>
                    <div class="legend-value">${item.value.toFixed(1)} lbs (${percent.toFixed(1)}%)</div>
                </div>
            `;
            legend.appendChild(legendItem);
            legendItem.addEventListener('mouseenter', () => circle.style.transform = 'scale(1.05)');
            legendItem.addEventListener('mouseleave', () => circle.style.transform = 'scale(1)');
            circle.addEventListener('mouseenter', () => legendItem.style.backgroundColor = '#f3f4f6');
            circle.addEventListener('mouseleave', () => legendItem.style.backgroundColor = 'transparent');
        });
        const textGroup = document.createElementNS(svgNS, 'g');
        textGroup.classList.add('chart-text');
        const numberText = document.createElementNS(svgNS, 'text');
        numberText.setAttribute('x', '50%');
        numberText.setAttribute('y', '50%');
        numberText.setAttribute('dy', '0.1em');
        numberText.classList.add('chart-number');
        numberText.textContent = centerText.value;
        const labelText = document.createElementNS(svgNS, 'text');
        labelText.setAttribute('x', '50%');
        labelText.setAttribute('y', '50%');
        labelText.setAttribute('dy', '1.2em');
        labelText.classList.add('chart-label');
        labelText.textContent = centerText.label;
        textGroup.appendChild(numberText);
        textGroup.appendChild(labelText);
        svg.appendChild(textGroup);
        container.appendChild(svg);
        container.appendChild(legend);
    }
    function renderMeasurementsView() {
        if (measurementsAfter.length > 0) {
            renderComparisonTable();
        }
        else {
            renderBarChart(measurementsBefore);
        }
    }
    function renderComparisonTable() {
        var _a, _b;
        const container = document.getElementById('measurementsChartContainer');
        if (!container)
            return;
        const beforeMap = new Map(measurementsBefore.map(m => [m.name, parseFloat(m.value)]));
        const afterMap = new Map(measurementsAfter.map(m => [m.name, parseFloat(m.value)]));
        const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
        let tableHtml = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Measurement</th>
                        <th>Before</th>
                        <th>After</th>
                        <th>Change</th>
                    </tr>
                </thead>
                <tbody>
        `;
        for (const name of Array.from(allKeys).sort()) {
            const beforeVal = beforeMap.get(name);
            const afterVal = afterMap.get(name);
            const change = (afterVal !== null && afterVal !== void 0 ? afterVal : 0) - (beforeVal !== null && beforeVal !== void 0 ? beforeVal : 0);
            let changeHtml = '--';
            if (isFinite(change) && beforeVal !== undefined && afterVal !== undefined) {
                const changeClass = change > 0 ? 'change-positive' : (change < 0 ? 'change-negative' : '');
                const arrow = change > 0 ? '↑' : (change < 0 ? '↓' : '');
                changeHtml = `<span class="${changeClass}">${arrow} ${Math.abs(change).toFixed(2)}</span>`;
            }
            tableHtml += `
                <tr>
                    <td>${name}</td>
                    <td>${(_a = beforeVal === null || beforeVal === void 0 ? void 0 : beforeVal.toFixed(2)) !== null && _a !== void 0 ? _a : '--'}</td>
                    <td>${(_b = afterVal === null || afterVal === void 0 ? void 0 : afterVal.toFixed(2)) !== null && _b !== void 0 ? _b : '--'}</td>
                    <td>${changeHtml}</td>
                </tr>
            `;
        }
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }
    function renderBarChart(measurements) {
        const container = document.getElementById('measurementsChartContainer');
        const tooltip = document.getElementById('chartTooltip');
        if (!container || !tooltip) {
            return;
        }
        const parsedData = (measurements || [])
            .map(item => ({
            name: item.name,
            value: parseFloat(item.value)
        }))
            .filter(item => item.name && typeof item.name === 'string' && isFinite(item.value));
        if (parsedData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">No measurement data available. Upload a CSV to see the chart.</p>';
            return;
        }
        const sortedData = parsedData.sort((a, b) => b.value - a.value);
        container.innerHTML = '';
        const svgNS = "http://www.w3.org/2000/svg";
        const margin = { top: 10, right: 40, bottom: 30, left: 120 };
        const containerRect = container.getBoundingClientRect();
        const chartWidth = containerRect.width > 0 ? containerRect.width : 350;
        const width = chartWidth - margin.left - margin.right;
        const height = sortedData.length * 28;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', String(chartWidth));
        svg.setAttribute('height', String(height + margin.top + margin.bottom));
        const chartGroup = document.createElementNS(svgNS, 'g');
        chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
        const values = sortedData.map(d => d.value);
        const maxValue = Math.max(0, ...values);
        const xScale = (v) => (maxValue > 0 ? (v / maxValue) * width : 0);
        const yScale = (i) => i * (height / sortedData.length);
        const barHeight = (height / sortedData.length) * 0.8;
        sortedData.forEach((d, i) => {
            const yPos = yScale(i);
            const value = d.value;
            const g = document.createElementNS(svgNS, 'g');
            g.classList.add('measurement-bar-group');
            const bar = document.createElementNS(svgNS, 'rect');
            bar.setAttribute('class', 'measurement-bar');
            bar.setAttribute('y', String(yPos));
            bar.setAttribute('height', String(barHeight));
            bar.setAttribute('width', String(xScale(value)));
            bar.style.animationDelay = `${i * 40}ms`;
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('class', 'bar-value-label');
            text.setAttribute('x', String(xScale(value) + 5));
            text.setAttribute('y', String(yPos + barHeight / 2));
            text.setAttribute('dy', '0.35em');
            text.style.animationDelay = `${i * 40 + 400}ms`;
            text.textContent = `${value.toFixed(1)}"`;
            g.appendChild(bar);
            g.appendChild(text);
            g.addEventListener('mouseenter', (e) => {
                if (tooltip)
                    tooltip.style.display = 'block';
                if (tooltip)
                    tooltip.innerHTML = `<strong>${d.name}:</strong> ${d.value.toFixed(1)} in`;
            });
            g.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                if (tooltip)
                    tooltip.style.left = `${e.clientX - rect.left + 15}px`;
                if (tooltip)
                    tooltip.style.top = `${e.clientY - rect.top}px`;
            });
            g.addEventListener('mouseleave', () => {
                if (tooltip)
                    tooltip.style.display = 'none';
            });
            chartGroup.appendChild(g);
        });
        const yAxis = document.createElementNS(svgNS, 'g');
        yAxis.setAttribute('class', 'y-axis');
        sortedData.forEach((d, i) => {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('class', 'tick');
            text.setAttribute('x', '-10');
            text.setAttribute('y', String(yScale(i) + barHeight / 2));
            text.setAttribute('dy', '0.35em');
            text.setAttribute('text-anchor', 'end');
            text.style.animationDelay = `${i * 40}ms`;
            text.textContent = d.name;
            yAxis.appendChild(text);
        });
        chartGroup.appendChild(yAxis);
        const xAxisLine = document.createElementNS(svgNS, 'line');
        xAxisLine.setAttribute('class', 'axis-line');
        xAxisLine.setAttribute('x1', '0');
        xAxisLine.setAttribute('x2', String(width));
        xAxisLine.setAttribute('y1', String(height));
        xAxisLine.setAttribute('y2', String(height));
        chartGroup.appendChild(xAxisLine);
        svg.appendChild(chartGroup);
        container.appendChild(svg);
    }
    function renderDiseaseRiskChart(risks, container) {
        if (!container)
            return;
        container.innerHTML = '';
        const svgNS = "http://www.w3.org/2000/svg";
        const validRisks = Object.entries(risks)
            .map(([name, value]) => ({ name: name.replace('Risk', ''), value: parseFloat(value || '0') }))
            .filter(d => d.value > 0);
        if (validRisks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">No risk multiplier data available.</p>';
            return;
        }
        validRisks.sort((a, b) => b.value - a.value);
        const margin = { top: 20, right: 50, bottom: 20, left: 100 };
        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width > 0 ? containerRect.width - margin.left - margin.right : 200;
        const height = validRisks.length * 40;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', String(containerRect.width || 350));
        svg.setAttribute('height', String(height + margin.top + margin.bottom));
        const chartGroup = document.createElementNS(svgNS, 'g');
        chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
        const maxValue = Math.max(1.2, ...validRisks.map(d => d.value));
        // Scales
        const xScale = (v) => (v / maxValue) * width;
        const barHeight = 24;
        const getRiskColor = (value) => {
            if (value <= 1.2)
                return 'var(--healthy-green)';
            if (value <= 2.5)
                return 'var(--warning-orange)';
            return 'var(--danger-red)';
        };
        // Draw Baseline
        const baselineX = xScale(1);
        if (baselineX > 0 && baselineX < width) {
            const baselineLine = document.createElementNS(svgNS, 'line');
            baselineLine.setAttribute('class', 'baseline');
            baselineLine.setAttribute('x1', String(baselineX));
            baselineLine.setAttribute('x2', String(baselineX));
            baselineLine.setAttribute('y1', '-5');
            baselineLine.setAttribute('y2', String(height));
            chartGroup.appendChild(baselineLine);
            const baselineText = document.createElementNS(svgNS, 'text');
            baselineText.setAttribute('class', 'baseline-label');
            baselineText.setAttribute('x', String(baselineX));
            baselineText.setAttribute('y', '-8');
            baselineText.textContent = 'Avg. Risk';
            chartGroup.appendChild(baselineText);
        }
        // Draw Bars and Labels
        validRisks.forEach((d, i) => {
            const yPos = i * (height / validRisks.length);
            const g = document.createElementNS(svgNS, 'g');
            g.classList.add('risk-bar-group');
            const bar = document.createElementNS(svgNS, 'rect');
            bar.setAttribute('class', 'risk-bar');
            bar.setAttribute('y', String(yPos));
            bar.setAttribute('height', String(barHeight));
            bar.setAttribute('width', String(xScale(d.value)));
            bar.setAttribute('fill', getRiskColor(d.value));
            bar.style.animationDelay = `${i * 60}ms`;
            bar.setAttribute('rx', '4');
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('class', 'bar-value-label');
            text.setAttribute('x', String(xScale(d.value) + 8));
            text.setAttribute('y', String(yPos + barHeight / 2));
            text.style.animationDelay = `${i * 60 + 400}ms`;
            text.setAttribute('dy', '0.35em');
            text.textContent = `${d.value.toFixed(1)}x`;
            g.appendChild(bar);
            g.appendChild(text);
            chartGroup.appendChild(g);
        });
        // Draw Y-Axis
        const yAxis = document.createElementNS(svgNS, 'g');
        yAxis.setAttribute('class', 'y-axis');
        validRisks.forEach((d, i) => {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('class', 'tick');
            text.setAttribute('x', '-10');
            text.setAttribute('y', String(i * (height / validRisks.length) + barHeight / 2));
            text.setAttribute('dy', '0.35em');
            text.setAttribute('text-anchor', 'end');
            text.style.animationDelay = `${i * 60}ms`;
            const labelMap = {
                'Cardio': 'Cardio.',
                'Respiratory': 'Resp.',
                'Other': 'Other'
            };
            text.textContent = labelMap[d.name] || d.name;
            yAxis.appendChild(text);
        });
        chartGroup.appendChild(yAxis);
        svg.appendChild(chartGroup);
        container.appendChild(svg);
    }
    function renderPdfInsights() {
        const pdfInsightsPanel = document.getElementById('pdf-insights-panel');
        const bodyShapeInsightsPanel = document.getElementById('pdf-composition-insights'); // Contains shape/WHR
        const compositionAnalysisPanel = document.getElementById('composition-analysis-panel'); // New standalone panel
        const bodyFatRankingPanel = document.getElementById('body-fat-ranking-panel');
        const hasData = !!reportDataBefore;
        if (pdfInsightsPanel)
            pdfInsightsPanel.style.display = hasData ? 'block' : 'none';
        if (bodyShapeInsightsPanel)
            bodyShapeInsightsPanel.style.display = hasData ? 'block' : 'none';
        if (compositionAnalysisPanel)
            compositionAnalysisPanel.style.display = hasData ? 'block' : 'none';
        if (bodyFatRankingPanel)
            bodyFatRankingPanel.style.display = hasData ? 'block' : 'none';
        if (!hasData) {
            return;
        }
        const el = (id) => document.getElementById(id);
        renderMeasurementsView();
        // --- Render BEFORE data ---
        const dataBefore = reportDataBefore;
        if (dataBefore) {
            // Body Composition
            const bodyCompContainer = el('bodyCompBreakdownContainer');
            const totalWeightNumB = parseFloat(String(dataBefore['Total Weight']));
            const leanMassNumB = parseFloat(String(dataBefore['Lean Mass']));
            const fatMassNumB = parseFloat(String(dataBefore['Fat Mass']));
            const boneMassNumB = parseFloat(String(dataBefore['Bone Mass']));
            if (bodyCompContainer && isFinite(totalWeightNumB) && isFinite(leanMassNumB) && isFinite(fatMassNumB) && isFinite(boneMassNumB)) {
                const bodyCompData = [
                    { label: 'Lean Mass', value: leanMassNumB, color: '#0077ff' },
                    { label: 'Fat Mass', value: fatMassNumB, color: '#f59e0b' },
                    { label: 'Bone Mass', value: boneMassNumB, color: '#a855f7' }
                ];
                createDonutChart(bodyCompContainer, bodyCompData, { value: totalWeightNumB.toFixed(1), label: 'Total lbs' });
            }
            // Fat Distribution
            const fatDistContainer = el('fatDistributionBreakdownContainer');
            if (fatDistContainer && isFinite(fatMassNumB)) {
                const visceralFatNum = parseFloat(String(dataBefore['Visceral Fat'] || '0'));
                const subcutaneousFatNum = parseFloat(String(dataBefore['Subcutaneous Fat'] || '0'));
                const androidMassNum = parseFloat(String(dataBefore['Android Mass'] || '0'));
                const gynoidMassNum = parseFloat(String(dataBefore['Gynoid Mass'] || '0'));
                const knownFat = visceralFatNum + subcutaneousFatNum + androidMassNum + gynoidMassNum;
                const otherFat = Math.max(0, fatMassNumB - knownFat);
                const fatDistData = [
                    { label: 'Visceral Fat', value: visceralFatNum, color: '#ef4444' },
                    { label: 'Subcutaneous Fat', value: subcutaneousFatNum, color: '#f97316' },
                    { label: 'Android Fat', value: androidMassNum, color: '#eab308' },
                    { label: 'Gynoid Fat', value: gynoidMassNum, color: '#84cc16' },
                    { label: 'Other Fat', value: otherFat, color: '#6b7280' }
                ].filter(d => d.value > 0);
                createDonutChart(fatDistContainer, fatDistData, { value: fatMassNumB.toFixed(1), label: 'Total Fat lbs' });
            }
            // Rankings
            const fatPct = dataBefore['Body Fat %'] ? parseFloat(dataBefore['Body Fat %']) : NaN;
            el('pdfYourRank').style.display = isFinite(fatPct) ? 'block' : 'none';
            if (isFinite(fatPct)) {
                el('pdfRankValue').textContent = `${fatPct.toFixed(1)}%`;
                el('pdfRankLabel').textContent = dataBefore.RankLabel || getRankCategory(fatPct);
                const rankPct = Math.max(0, Math.min(100, (fatPct - 10) / 40 * 100));
                el('pdfYourRank').querySelector('.progress-bar-marker').style.left = `${rankPct}%`;
            }
            const compareValue = dataBefore.CompareValue ? parseFloat(dataBefore.CompareValue) : NaN;
            el('pdfComparisonRank').style.display = isFinite(compareValue) ? 'block' : 'none';
            if (isFinite(compareValue)) {
                const percentile = 100 - compareValue;
                el('pdfComparisonRank').querySelector('.progress-bar-marker').style.left = `${Math.max(0, Math.min(100, percentile))}%`;
                el('pdfCompareSummary').textContent = dataBefore.CompareSummary || '';
            }
            // Disease Risk
            const risks = { 'CancerRisk': dataBefore.CancerRisk, 'CardioRisk': dataBefore.CardioRisk, 'RespiratoryRisk': dataBefore.RespiratoryRisk, 'OtherRisk': dataBefore.OtherRisk };
            renderDiseaseRiskChart(risks, el('diseaseRiskChartContainer'));
        }
        // --- Render AFTER data ---
        const afterContainers = document.querySelectorAll('.comparison-after');
        const dataAfter = reportDataAfter;
        if (dataAfter) {
            afterContainers.forEach(c => c.style.display = 'block');
            // Body Composition
            const bodyCompContainer = el('bodyCompBreakdownContainer_after');
            const totalWeightNumA = parseFloat(String(dataAfter['Total Weight']));
            const leanMassNumA = parseFloat(String(dataAfter['Lean Mass']));
            const fatMassNumA = parseFloat(String(dataAfter['Fat Mass']));
            const boneMassNumA = parseFloat(String(dataAfter['Bone Mass']));
            if (bodyCompContainer && isFinite(totalWeightNumA) && isFinite(leanMassNumA) && isFinite(fatMassNumA) && isFinite(boneMassNumA)) {
                const bodyCompData = [
                    { label: 'Lean Mass', value: leanMassNumA, color: '#0077ff' },
                    { label: 'Fat Mass', value: fatMassNumA, color: '#f59e0b' },
                    { label: 'Bone Mass', value: boneMassNumA, color: '#a855f7' }
                ];
                createDonutChart(bodyCompContainer, bodyCompData, { value: totalWeightNumA.toFixed(1), label: 'Total lbs' });
            }
            // Fat Distribution
            const fatDistContainer = el('fatDistributionBreakdownContainer_after');
            if (fatDistContainer && isFinite(fatMassNumA)) {
                const visceralFatNum = parseFloat(String(dataAfter['Visceral Fat'] || '0'));
                const subcutaneousFatNum = parseFloat(String(dataAfter['Subcutaneous Fat'] || '0'));
                const androidMassNum = parseFloat(String(dataAfter['Android Mass'] || '0'));
                const gynoidMassNum = parseFloat(String(dataAfter['Gynoid Mass'] || '0'));
                const knownFat = visceralFatNum + subcutaneousFatNum + androidMassNum + gynoidMassNum;
                const otherFat = Math.max(0, fatMassNumA - knownFat);
                const fatDistData = [
                    { label: 'Visceral Fat', value: visceralFatNum, color: '#ef4444' },
                    { label: 'Subcutaneous Fat', value: subcutaneousFatNum, color: '#f97316' },
                    { label: 'Android Fat', value: androidMassNum, color: '#eab308' },
                    { label: 'Gynoid Fat', value: gynoidMassNum, color: '#84cc16' },
                    { label: 'Other Fat', value: otherFat, color: '#6b7280' }
                ].filter(d => d.value > 0);
                createDonutChart(fatDistContainer, fatDistData, { value: fatMassNumA.toFixed(1), label: 'Total Fat lbs' });
            }
            // Rankings
            const fatPct = dataAfter['Body Fat %'] ? parseFloat(dataAfter['Body Fat %']) : NaN;
            el('pdfYourRank_after').style.display = isFinite(fatPct) ? 'block' : 'none';
            if (isFinite(fatPct)) {
                el('pdfRankValue_after').textContent = `${fatPct.toFixed(1)}%`;
                el('pdfRankLabel_after').textContent = dataAfter.RankLabel || getRankCategory(fatPct);
                const rankPct = Math.max(0, Math.min(100, (fatPct - 10) / 40 * 100));
                el('pdfYourRank_after').querySelector('.progress-bar-marker').style.left = `${rankPct}%`;
            }
            const compareValue = dataAfter.CompareValue ? parseFloat(dataAfter.CompareValue) : NaN;
            el('pdfComparisonRank_after').style.display = isFinite(compareValue) ? 'block' : 'none';
            if (isFinite(compareValue)) {
                const percentile = 100 - compareValue;
                el('pdfComparisonRank_after').querySelector('.progress-bar-marker').style.left = `${Math.max(0, Math.min(100, percentile))}%`;
                el('pdfCompareSummary_after').textContent = dataAfter.CompareSummary || '';
            }
            // Disease Risk
            const risks = { 'CancerRisk': dataAfter.CancerRisk, 'CardioRisk': dataAfter.CardioRisk, 'RespiratoryRisk': dataAfter.RespiratoryRisk, 'OtherRisk': dataAfter.OtherRisk };
            renderDiseaseRiskChart(risks, el('diseaseRiskChartContainer_after'));
        }
        else {
            afterContainers.forEach(c => c.style.display = 'none');
        }
    }
    // --- EVENT LISTENERS ---
    const inputsToMonitor = ["height", "weight", "age", "restingHeartRate", "gender", "bpSystolic", "bpDiastolic"];
    inputsToMonitor.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", updateCalculatedFields);
            if (el.tagName === "SELECT") {
                el.addEventListener("change", updateCalculatedFields);
            }
        }
    });
    ['age', 'restingHeartRate', 'bpSystolic', 'visceralFat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (!reportDataAfter) { // only revert to calculated if we aren't in a comparison view
                    bodyAgeDataBefore.source = 'calculated';
                }
                updateCalculatedFields();
            });
        }
    });
    ['weight'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const visceralFatEl = document.getElementById('visceralFat');
                if (visceralFatEl) {
                    delete visceralFatEl.dataset.source;
                }
                updateCalculatedFields();
            });
        }
    });
    // --- GAUGE INTERACTIONS ---
    function setupBmiGaugeInteractions(suffix = '') {
        const bmiCategories = {
            under: { el: document.getElementById('bmiGaugeUnder' + suffix), text: '< 18.5', range: 'Underweight' },
            healthy: { el: document.getElementById('bmiGaugeHealthy' + suffix), text: '18.5 - 24.9', range: 'Healthy' },
            over: { el: document.getElementById('bmiGaugeOver' + suffix), text: '25.0 - 29.9', range: 'Overweight' },
            obese: { el: document.getElementById('bmiGaugeObese' + suffix), text: '≥ 30.0', range: 'Obese' }
        };
        const valueEl = document.getElementById("bmiGaugeValue" + suffix);
        const labelEl = document.getElementById("bmiGaugeLabel" + suffix);
        const lastBmi = () => suffix === '_after' ? lastDisplayedBmiAfter : lastDisplayedBmi;
        Object.values(bmiCategories).forEach(cat => {
            if (cat.el) {
                cat.el.addEventListener('mouseenter', () => {
                    if (labelEl)
                        labelEl.textContent = cat.range;
                    if (valueEl) {
                        valueEl.style.fontSize = "1.4em"; // smaller to fit text
                        valueEl.textContent = cat.text;
                    }
                });
                cat.el.addEventListener('mouseleave', () => {
                    const currentBmi = lastBmi();
                    if (labelEl)
                        labelEl.textContent = getBmiLabel(currentBmi);
                    if (valueEl) {
                        valueEl.style.fontSize = "1.8em"; // restore size
                        valueEl.textContent = currentBmi !== null && isFinite(currentBmi) ? currentBmi.toFixed(1) : '--';
                    }
                });
            }
        });
    }
    // --- INITIALIZE APP STATE ---
    updateCalculatedFields();
    renderMeasurementsView();
    setupBmiGaugeInteractions('');
    setupBmiGaugeInteractions('_after');
});
