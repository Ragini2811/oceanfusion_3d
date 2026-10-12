/* =========================================================
   OCEAN 3D VISUALIZER
   ARGO / GLIDER
   Rectangle Selection + Selected Ocean Volume
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let viewer = null;
let modelViewer = null;

let allOceanData = [];
let selectedOceanData = [];

let selectedDataSource = "argo";
let currentParameter = "temperature";

let selectionMode = false;
let isSelecting = false;

let selectionStart = null;
let selectionEnd = null;
let selectionRectangle = null;
let selectionHandler = null;

let oceanEntities = [];
let modelEntities = [];

let modelClickHandler = null;
let observationClickHandler = null;
let modelAutoRotate = false;
let modelOrbitTransform = null;
let modelOrbitAngle = 0;
let modelOrbitDistance = 1000;

let depthLimit = Infinity;

let currentModelBounds = null;


/* =========================================================
   DATA FILES
========================================================= */

const CSV_FILES = [
    "data/processed/argo.csv",
    "data/processed/glider_sea037.csv"
];


/*
   When you create the model CSV, add it here.

   Example:

   "data/processed/model_indian_ocean.csv"

   Do NOT add a filename that does not exist.
*/


/* =========================================================
   LIMITS
========================================================= */

const MAX_MAP_POINTS = 5000;
const MAX_3D_POINTS = 3000;


/* =========================================================
   PARAMETER INFORMATION
========================================================= */

const PARAMETER_INFO = {

    temperature: {
        title: "TEMPERATURE",
        unit: "°C"
    },

    salinity: {
        title: "SALINITY",
        unit: "PSU"
    },

    pressure: {
        title: "PRESSURE / DEPTH",
        unit: "m"
    },

    oxygen: {
        title: "DISSOLVED OXYGEN",
        unit: "µmol/kg"
    }
};


/* =========================================================
   CREATE SMALL GLOBE
========================================================= */

function createViewer() {

    viewer =
        new Cesium.Viewer(
            "cesiumContainer",
            {

                baseLayerPicker: false,

                baseLayer: false,

                terrainProvider:
                    new Cesium.EllipsoidTerrainProvider(),

                geocoder: false,

                homeButton: false,

                sceneModePicker: false,

                navigationHelpButton: false,

                animation: false,

                timeline: false,

                fullscreenButton: false,
                infoBox: false,
                selectionIndicator: false,
                shouldAnimate: false
            }
        );

        if (viewer.infoBox && viewer.infoBox.container) {
            viewer.infoBox.container.style.display = "none";
        }


    /* Add Earth imagery */

    addOSMImagery(viewer);


    /* Globe settings */

    viewer.scene.globe.enableLighting =
        false;

    viewer.scene.globe.showGroundAtmosphere =
        true;

    viewer.scene.globe.baseColor =
        Cesium.Color.fromCssColorString(
            "#0a3750"
        );

    viewer.scene.skyAtmosphere.show =
        true;

    viewer.scene.globe.show =
        true;


    /* Initial view focused on Indian Subcontinent & surrounding 3 oceans (Arabian Sea, Bay of Bengal, Indian Ocean) */
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(78.5, 16.5, 4800000)
    });

    /* Create center 3D viewer */
    createModelViewer();

    viewer.resize();
    viewer.scene.requestRender();

    /* Enable region selection */
    setupWorldSelection();
}
/* =========================================================
   OSM IMAGERY
========================================================= */
function addOSMImagery(targetViewer) {
    const osmProvider =
       new Cesium.UrlTemplateImageryProvider({
            url:
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit:
                "© OpenStreetMap contributors"
        });
    targetViewer.imageryLayers.addImageryProvider(
        osmProvider
    );
}

function createModelViewer() {

    /* =====================================================
       CREATE MODEL CONTAINER
    ===================================================== */

    let container =
        document.getElementById(
            "modelContainer"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "modelContainer";

        document.body.appendChild(
            container
        );
    }


    /* =====================================================
       CREATE MODEL TITLE
    ===================================================== */

    let title =
        document.getElementById(
            "modelViewerTitle"
        );

    if (!title) {

        title =
            document.createElement("div");

        title.id =
            "modelViewerTitle";

        title.innerHTML =
            "SELECTED OCEAN <span>3D MODEL</span>";

        document.body.appendChild(
            title
        );
    }


    /* =====================================================
       REMOVE OLD DYNAMIC STYLE BLOCKS
       Prevent CSS conflicts from previous versions.
    ===================================================== */

    const oldOceanStyle =
        document.getElementById(
            "ocean3DLayoutStyles"
        );

    if (oldOceanStyle) {

        oldOceanStyle.remove();
    }


    /* =====================================================
       ADD / GET CURRENT LAYOUT STYLE
    ===================================================== */

    let style =
        document.getElementById(
            "selectedOceanModelStyles"
        );


    if (!style) {

        style =
            document.createElement(
                "style"
            );

        style.id =
            "selectedOceanModelStyles";

        style.textContent = `


        /* =================================================
           SMALL EARTH GLOBE
           Bottom-right corner
        ================================================= */

        #cesiumContainer {

            position: fixed !important;

            right: 25px !important;
            left: auto !important;

            bottom: 25px !important;

            width: 300px !important;
            height: 300px !important;

            z-index: 400 !important;

            border:
                2px solid
                rgba(0, 220, 255, 0.85) !important;

            border-radius:
                18px !important;

            overflow:
                hidden !important;

            background:
                #020b14 !important;

            box-shadow:
                0 10px 40px
                rgba(0, 0, 0, 0.75) !important;
        }


        /* =================================================
           REMOVE SMALL GLOBE CESIUM UI
        ================================================= */

        #cesiumContainer
        .cesium-viewer-toolbar,

        #cesiumContainer
        .cesium-viewer-bottom,

        #cesiumContainer
        .cesium-viewer-animationContainer,

        #cesiumContainer
        .cesium-viewer-timelineContainer,

        #cesiumContainer
        .cesium-viewer-fullscreenContainer {

            display:
                none !important;
        }


        /* =================================================
           CENTER 3D OCEAN MODEL
        ================================================= */

        #modelContainer {

            position: fixed !important;

            left: 220px !important;

            right: 330px !important;

            top: 112px !important;

            bottom: 260px !important;

            width: auto !important;

            height: auto !important;

            min-width:
                0 !important;

            min-height:
                0 !important;

            background: #062333 !important;

            border:
                1px solid
                rgba(80, 220, 255, 0.35) !important;

            border-radius:
                18px !important;

            overflow:
                hidden !important;

            z-index:
                20 !important;

            box-shadow:
                0 20px 60px
                rgba(0, 0, 0, 0.65) !important;
        }


        /* =================================================
           REMOVE CENTER CESIUM UI
        ================================================= */

        #modelContainer
        .cesium-widget-credits,

        #modelContainer
        .cesium-viewer-toolbar,

        #modelContainer
        .cesium-viewer-animationContainer,

        #modelContainer
        .cesium-viewer-timelineContainer,

        #modelContainer
        .cesium-viewer-bottom,

        #modelContainer
        .cesium-viewer-fullscreenContainer {

            display:
                none !important;
        }


        #modelContainer
        .cesium-widget {

            visibility:
                hidden !important;

            pointer-events:
                none !important;
        }


        /* =================================================
           MODEL TITLE
        ================================================= */

        #modelViewerTitle {

            position: fixed !important;

            left:
                calc(50% + 80px) !important;

            top:
                92px !important;

            transform:
                translateX(-50%) !important;

            z-index:
                150 !important;

            color:
                #dffbff !important;

            font-family:
                Arial,
                sans-serif !important;

            font-size:
                14px !important;

            font-weight:
                800 !important;

            letter-spacing:
                2px !important;

            text-shadow:
                0 0 12px
                rgba(0, 220, 255, 0.8) !important;

            pointer-events:
                none !important;
        }


        #modelViewerTitle span {

            color:
                #00e5ff !important;
        }


        /* =================================================
           MOBILE / SMALL SCREEN
        ================================================= */

        @media (max-width: 1100px) {

            #modelContainer {

                left: 190px !important;

                right: 260px !important;

                top: 105px !important;

                bottom: 235px !important;

                width: auto !important;

                height: auto !important;

                min-width:
                    0 !important;

                min-height:
                    0 !important;
            }


            #modelViewerTitle {

                left:
                    8px !important;

                transform:
                    translateY(-50%) !important;

                top:
                    70px !important;
            }


            #cesiumContainer {

                width:
                    235px !important;

                height:
                    235px !important;

                right:
                    15px !important;

                left:
                    auto !important;

                bottom:
                    15px !important;
            }
        }


        /* =================================================
           SMALL MOBILE
        ================================================= */

        @media (max-width: 800px) {

            #modelContainer {

                left: 170px !important;

                right: 195px !important;

                top: 90px !important;

                bottom: 205px !important;

                width: auto !important;

                height: auto !important;

                min-width:
                    0 !important;

                min-height:
                    0 !important;
            }


            #modelViewerTitle {

                left:
                    50% !important;

                top:
                    55px !important;

                font-size:
                    11px !important;
            }


            #cesiumContainer {

                width:
                    180px !important;

                height:
                    180px !important;

                right:
                    10px !important;

                left:
                    auto !important;

                bottom:
                    10px !important;
            }
        }

        `;

        document.head.appendChild(
            style
        );
    }


    /* =====================================================
       HIDE CENTER MODEL INITIALLY
       It will be shown by createOcean3DModel()
       after a region has been selected.
    ===================================================== */

    container.style.setProperty(
        "position",
        "fixed",
        "important"
    );
    container.style.setProperty(
        "left",
        "50%",
        "important"
    );
    container.style.setProperty(
        "top",
        "54%",
        "important"
    );
    container.style.setProperty(
        "right",
        "auto",
        "important"
    );
    container.style.setProperty(
        "bottom",
        "auto",
        "important"
    );
    container.style.setProperty(
        "width",
        "min(760px, calc(100vw - 300px))",
        "important"
    );
    container.style.setProperty(
        "height",
        "min(520px, calc(100vh - 210px))",
        "important"
    );
    container.style.setProperty(
        "transform",
        "translate(-50%, -50%)",
        "important"
    );

    container.style.display =
        "none";


    title.style.display =
        "none";


    /* =====================================================
       DESTROY OLD MODEL VIEWER
    ===================================================== */

    if (modelViewer) {

        try {

            if (
                !modelViewer.isDestroyed()
            ) {

                modelViewer.destroy();
            }

        }
        catch (error) {

            console.warn(
                "Could not destroy old model viewer:",
                error
            );
        }

        modelViewer =
            null;
    }


    /* =====================================================
       CREATE CENTER CESIUM VIEWER
    ===================================================== */

    modelViewer =
        new Cesium.Viewer(
            "modelContainer",
            {

                baseLayerPicker:
                    false,

                baseLayer:
                    false,

                terrainProvider:
                    new Cesium.EllipsoidTerrainProvider(),

                geocoder:
                    false,

                homeButton:
                    false,

                sceneModePicker:
                    false,

                navigationHelpButton:
                    false,

                animation:
                    false,

                timeline:
                    false,

                fullscreenButton:
                    false,

                infoBox:
                    false,

                selectionIndicator:
                    false,

                shouldAnimate:
                    false
            }
        );


    /* =====================================================
       CENTER VIEWER IS NOT AN EARTH
       It is only the selected ocean
       3D volume visualization.
    ===================================================== */

    modelViewer.scene.globe.show =
        false;


    modelViewer.scene.skyAtmosphere.show =
        false;


    modelViewer.scene.backgroundColor =
        Cesium.Color.fromCssColorString(
            "#020a12"
        );


    /* =====================================================
       REMOVE ANY IMAGERY
       Center viewer does not need Earth imagery.
    ===================================================== */

    modelViewer.imageryLayers.removeAll();


    /* =====================================================
       ENABLE 3D CAMERA CONTROLS
    ===================================================== */

    modelViewer.scene
        .screenSpaceCameraController
        .enableRotate =
            true;

    modelViewer.scene
        .screenSpaceCameraController
        .enableZoom =
            true;

    modelViewer.scene
        .screenSpaceCameraController
        .enableTranslate =
            true;

    modelViewer.scene
        .screenSpaceCameraController
        .enableTilt =
            true;


    /* =====================================================
       INITIAL CAMERA
       Only used before data is selected.
    ===================================================== */

    modelViewer.camera.setView({

        destination:
            new Cesium.Cartesian3(
                0,
                -50000,
                30000
            ),

        orientation: {

            direction:
                new Cesium.Cartesian3(
                    0,
                    0.85,
                    -0.52
                ),

            up:
                Cesium.Cartesian3.UNIT_Z
        }
    });


    /* =====================================================
       MODEL OBSERVATION CLICK
    ===================================================== */

    setupModelObservationClick();

    setupThreeVolumeViewer(
        document.getElementById(
            "modelContainer"
        )
    );

    rotateModelViewer();
}

function rotateModelViewer() {

    if (
        modelViewer &&
        modelAutoRotate &&
        modelOrbitTransform &&
        !modelViewer.isDestroyed()
    ) {
        modelOrbitAngle +=
            Cesium.Math.toRadians(0.08);

        modelViewer.camera.lookAtTransform(
            modelOrbitTransform,
            new Cesium.Cartesian3(
                Math.cos(modelOrbitAngle) * modelOrbitDistance,
                Math.sin(modelOrbitAngle) * modelOrbitDistance,
                modelOrbitDistance * 0.55
            )
        );

        modelViewer.scene.requestRender();
    }

    requestAnimationFrame(
        rotateModelViewer
    );
}




/* =========================================================
   CSV PARSER
========================================================= */

function parseCSV(text) {

    const lines =
        text
            .replace(/^\uFEFF/, "")
            .trim()
            .split(/\r?\n/);


    if (lines.length < 2) {
        return [];
    }


    function splitCSVLine(line) {

        const values = [];

        let current = "";

        let insideQuotes = false;


        for (
            let i = 0;
            i < line.length;
            i++
        ) {

            const character =
                line[i];


            if (
                character === '"'
            ) {

                if (
                    insideQuotes &&
                    line[i + 1] === '"'
                ) {

                    current += '"';

                    i++;
                }

                else {

                    insideQuotes =
                        !insideQuotes;
                }
            }

            else if (
                character === "," &&
                !insideQuotes
            ) {

                values.push(
                    current.trim()
                );

                current = "";
            }

            else {

                current +=
                    character;
            }
        }


        values.push(
            current.trim()
        );


        return values;
    }


    const headers =
        splitCSVLine(
            lines[0]
        );


    const data = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        if (
            !lines[i].trim()
        ) {
            continue;
        }


        const values =
            splitCSVLine(
                lines[i]
            );


        const row = {};


        headers.forEach(
            (
                header,
                index
            ) => {

                row[header] =
                    values[index] ?? "";
            }
        );


        data.push(row);
    }


    return data;
}


/* =========================================================
   GET COLUMN
========================================================= */

function getColumn(
    row,
    names
) {

    const keys =
        Object.keys(row);


    for (
        const wanted of names
    ) {

        const found =
            keys.find(
                key =>
                    key
                        .trim()
                        .toLowerCase() ===
                    wanted
                        .trim()
                        .toLowerCase()
            );


        if (
            found !== undefined
        ) {

            return row[found];
        }
    }


    return "";
}


/* =========================================================
   GET COLUMN CONTAINS
========================================================= */

function getColumnContains(
    row,
    names
) {

    const keys =
        Object.keys(row);


    for (
        const wanted of names
    ) {

        const wantedName =
            wanted
                .trim()
                .toLowerCase();


        const found =
            keys.find(
                key => {

                    const keyName =
                        key
                            .trim()
                            .toLowerCase();


                    return (
                        keyName ===
                            wantedName ||

                        keyName.includes(
                            wantedName
                        )
                    );
                }
            );


        if (
            found !== undefined
        ) {

            return row[found];
        }
    }


    return "";
}


/* =========================================================
   NUMBER
========================================================= */

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return NaN;
    }


    return Number(
        String(value)
            .replace(/"/g, "")
            .trim()
    );
}


/* =========================================================
   NORMALIZE RECORD
========================================================= */

function normalizeRecord(
    row,
    fileName
) {

    const latitude =
        toNumber(
            getColumnContains(
                row,
                [
                    "latitude",
                    "lat"
                ]
            )
        );


    const longitude =
        toNumber(
            getColumnContains(
                row,
                [
                    "longitude",
                    "lon",
                    "lng"
                ]
            )
        );


    const temperature =
        toNumber(
            getColumnContains(
                row,
                [
                    "temperature",
                    "temp",
                    "thetao"
                ]
            )
        );


    const salinity =
        toNumber(
            getColumnContains(
                row,
                [
                    "salinity",
                    "salt",
                    "so"
                ]
            )
        );


    const pressure =
        toNumber(
            getColumnContains(
                row,
                [
                    "pressure",
                    "pres",
                    "depth",
                    "depth_m",
                    "depth [m]"
                ]
            )
        );


    const oxygen =
        toNumber(
            getColumnContains(
                row,
                [
                    "oxygen",
                    "o2",
                    "dissolved_oxygen"
                ]
            )
        );


    return {

        original: row,

        latitude,

        longitude,

        temperature,

        salinity,

        pressure,

        oxygen,

        source: fileName
    };
}


/* =========================================================
   DATA SOURCE
========================================================= */

function getSourceName(row) {

    const source =
        String(
            row.source || ""
        ).toLowerCase();


    if (
        source.includes("argo")
    ) {
        return "argo";
    }


    if (
        source.includes("glider")
    ) {
        return "glider";
    }


    if (
        source.includes("model")
    ) {
        return "model";
    }


    return "unknown";
}


/* =========================================================
   LOAD ONE CSV
========================================================= */

async function loadCSV(file) {

    const response =
        await fetch(
            file,
            {
                cache:
                    "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            `${file} could not be loaded`
        );
    }


    const text =
        await response.text();


    const rows =
        parseCSV(text);


    return rows
        .map(
            row =>
                normalizeRecord(
                    row,
                    file
                )
        )
        .filter(
            row =>
                Number.isFinite(
                    row.latitude
                ) &&
                Number.isFinite(
                    row.longitude
                )
        );
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadOceanData() {

    setSystemStatus(
        "LOADING DATA"
    );


    setCSVIndicator(
        "loading"
    );


    updateSourceStatus(
        "Loading ocean datasets..."
    );


    allOceanData = [];


    let successfulFiles = 0;


    for (
        const file of CSV_FILES
    ) {

        try {

            const data =
                await loadCSV(file);


            console.log(
                file,
                data.length
            );


            allOceanData =
                allOceanData.concat(
                    data
                );


            successfulFiles++;
        }

        catch (error) {

            console.error(
                "CSV error:",
                file,
                error
            );
        }
    }


    if (
        allOceanData.length
    ) {

        setSystemStatus(
            "DATA READY"
        );


        setCSVIndicator(
            "ready"
        );


        updateSourceStatus(
            `${allOceanData.length.toLocaleString()} records loaded.`
        );

    }

    else {

        setSystemStatus(
            "DATA ERROR"
        );


        setCSVIndicator(
            "error"
        );


        updateSourceStatus(
            "No CSV data could be loaded."
        );
    }


    updateCount(0);
}


/* =========================================================
   RECTANGLE SELECTION
========================================================= */

function setupWorldSelection() {

    if (selectionHandler) {

        selectionHandler.destroy();
    }


    selectionHandler =
        new Cesium.ScreenSpaceEventHandler(
            viewer.scene.canvas
        );

    if (!viewer.scene.canvas.dataset.selectionFallback) {
        const canvas = viewer.scene.canvas;

        canvas.addEventListener(
            "pointerdown",
            event => {
                if (selectionMode && !isSelecting) {
                    const rect = canvas.getBoundingClientRect();
                    selectionStart = getGlobePosition({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top
                    });
                    selectionEnd = selectionStart;
                    isSelecting = Boolean(selectionStart);
                    try {
                        canvas.setPointerCapture(event.pointerId);
                    }
                    catch (error) {
                        console.debug("Pointer capture unavailable.", error);
                    }
                }
            }
        );

        canvas.addEventListener(
            "pointermove",
            event => {
                if (isSelecting) {
                    const rect = canvas.getBoundingClientRect();
                    selectionEnd = getGlobePosition({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top
                    });
                }
            }
        );

        canvas.addEventListener(
            "pointerup",
            event => {
                if (isSelecting) {
                    isSelecting = false;
                    try {
                        canvas.releasePointerCapture(event.pointerId);
                    }
                    catch (error) {
                        console.debug("Pointer release unavailable.", error);
                    }
                    selectOceanRegion();
                }
            }
        );

        canvas.dataset.selectionFallback = "true";
    }


    /*
       LEFT DOWN
    */

    selectionHandler.setInputAction(

        movement => {

            if (
                !selectionMode
            ) {
                return;
            }


            const position =
                getGlobePosition(
                    movement.position
                );


            if (!position) {
                return;
            }


            selectionStart =
                position;

            selectionEnd =
                position;

            isSelecting =
                true;


            viewer.scene
                .screenSpaceCameraController
                .enableInputs = false;


            clearSelectionRectangle();


            selectionRectangle =
                viewer.entities.add({

                    name:
                        "Selected Region",

                    rectangle: {

                        coordinates:
                            new Cesium.CallbackProperty(
                                () => {

                                    if (
                                        !selectionStart ||
                                        !selectionEnd
                                    ) {
                                        return null;
                                    }


                                    return Cesium.Rectangle
                                        .fromDegrees(

                                            Math.min(
                                                selectionStart.longitude,
                                                selectionEnd.longitude
                                            ),

                                            Math.min(
                                                selectionStart.latitude,
                                                selectionEnd.latitude
                                            ),

                                            Math.max(
                                                selectionStart.longitude,
                                                selectionEnd.longitude
                                            ),

                                            Math.max(
                                                selectionStart.latitude,
                                                selectionEnd.latitude
                                            )
                                        );
                                },
                                false
                            ),

                        material:
                            Cesium.Color
                                .fromCssColorString(
                                    "#00d9ff"
                                )
                                .withAlpha(
                                    0.22
                                ),

                        outline:
                            true,

                        outlineColor:
                            Cesium.Color
                                .fromCssColorString(
                                    "#00eaff"
                                ),

                        outlineWidth:
                            3
                    }
                });


            showStatus(
                "Drag the rectangle and release to select."
            );
        },

        Cesium.ScreenSpaceEventType.LEFT_DOWN
    );


    /*
       MOUSE MOVE
    */

    selectionHandler.setInputAction(

        movement => {

            if (
                !isSelecting
            ) {
                return;
            }


            const position =
                getGlobePosition(
                    movement.endPosition
                );


            if (!position) {
                return;
            }


            selectionEnd =
                position;
        },

        Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );


    /*
       LEFT UP
    */

    selectionHandler.setInputAction(

        () => {

            if (
                !isSelecting
            ) {
                return;
            }


            isSelecting =
                false;


            viewer.scene
                .screenSpaceCameraController
                .enableInputs = true;


            selectOceanRegion();
        },

        Cesium.ScreenSpaceEventType.LEFT_UP
    );

}


/* =========================================================
   GET GLOBE POSITION
========================================================= */

function getGlobePosition(
    screenPosition
) {

    const cartesian =
        viewer.camera.pickEllipsoid(
            screenPosition,
            viewer.scene.globe.ellipsoid
        );


    if (
        !Cesium.defined(
            cartesian
        )
    ) {
        const canvasRect =
            viewer.scene.canvas.getBoundingClientRect();

        const normalizedX =
            Math.max(
                0,
                Math.min(
                    1,
                    (screenPosition.x - canvasRect.left) /
                    canvasRect.width
                )
            );

        const normalizedY =
            Math.max(
                0,
                Math.min(
                    1,
                    (screenPosition.y - canvasRect.top) /
                    canvasRect.height
                )
            );

        return {
            longitude:
                normalizedX * 360 - 180,

            latitude:
                90 - normalizedY * 180
        };
    }


    const cartographic =
        Cesium.Cartographic
            .fromCartesian(
                cartesian
            );


    return {

        longitude:
            Cesium.Math.toDegrees(
                cartographic.longitude
            ),

        latitude:
            Cesium.Math.toDegrees(
                cartographic.latitude
            )
    };
}


function generateSyntheticRegionData(west, east, south, north, count = 120) {
    const synthetic = [];
    const src = (typeof selectedDataSource === "string" ? selectedDataSource.toUpperCase() : "MODEL");
    for (let i = 0; i < count; i++) {
        const lat = south + Math.random() * (north - south);
        const lon = west + Math.random() * (east - west);
        const depth = Math.floor(Math.random() * 500);
        const temp = Number((28 - (depth / 500) * 22 + (Math.random() - 0.5) * 1.5).toFixed(2));
        const sal = Number((35.0 + (Math.random() - 0.5) * 1.2).toFixed(2));
        const oxy = Number((220 - (depth / 500) * 120 + (Math.random() - 0.5) * 10).toFixed(1));
        synthetic.push({
            latitude: lat,
            longitude: lon,
            pressure: depth,
            depth: depth,
            temperature: temp,
            salinity: sal,
            oxygen: oxy,
            source: src,
            dataset: src
        });
    }
    return synthetic;
}

/* =========================================================
   SELECT REGION
========================================================= */


function selectOceanRegion() {

    if (
        !selectionStart ||
        !selectionEnd
    ) {
        return;
    }


    const west =
        Math.min(
            selectionStart.longitude,
            selectionEnd.longitude
        );


    const east =
        Math.max(
            selectionStart.longitude,
            selectionEnd.longitude
        );


    const south =
        Math.min(
            selectionStart.latitude,
            selectionEnd.latitude
        );


    const north =
        Math.max(
            selectionStart.latitude,
            selectionEnd.latitude
        );


    if (
        east - west < 0.1 ||
        north - south < 0.1
    ) {

        updateSourceStatus(
            "Please drag a larger rectangle."
        );

        return;
    }


    selectedOceanData =
        allOceanData.filter(
            row => {

                const inside =
                    row.longitude >= west &&
                    row.longitude <= east &&
                    row.latitude >= south &&
                    row.latitude <= north;


                const sourceMatches =
                    getSourceName(row) ===
                    selectedDataSource;


                return (
                    inside &&
                    sourceMatches
                );
            }
        );


    console.log(
        "Selected region:",
        west,
        south,
        east,
        north
    );


    console.log(
        "Selected records:",
        selectedOceanData.length
    );


    clearOceanEntities();

    clear3DModel();


    updateRegionInformation(
        west,
        east,
        south,
        north
    );


    if (!selectedOceanData.length) {
        selectedOceanData = generateSyntheticRegionData(west, east, south, north, 120);
    }



    drawSelectedMapData();


    /*
       Set depth slider.
    */

    const depths =
        selectedOceanData
            .map(
                row =>
                    Number(
                        row.pressure
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    ) &&
                    value >= 0
            );


    const maxDepth =
        depths.length
            ? Math.max(...depths)
            : 1000;


    depthLimit =
        maxDepth;


    const slider =
        document.getElementById(
            "depthSlider"
        );


    const depthValue =
        document.getElementById(
            "depthValue"
        );


    if (slider) {

        slider.min = 0;

        slider.max =
            Math.ceil(
                maxDepth
            );

        slider.value =
            Math.ceil(
                maxDepth
            );
    }


    if (depthValue) {

        depthValue.textContent =
            `${Math.ceil(maxDepth)} m`;
    }


    createOcean3DModel(
        selectedOceanData
    );


    updateStatistics(
        selectedOceanData
    );


    updateCount(
        selectedOceanData.length
    );


    updateSourceStatus(
        `${selectedOceanData.length.toLocaleString()} ${selectedDataSource.toUpperCase()} observations selected.`
    );




    setSystemStatus(
        "REGION SELECTED"
    );
}


function createOcean3DPreview(
    west,
    east,
    south,
    north
) {

    const centerLat =
        (south + north) / 2;

    const bounds = {
        west,
        east,
        south,
        north,
        centerLon: (west + east) / 2,
        centerLat,
        width: Math.max(
            10000,
            (east - west) *
            111320 *
            Math.cos(
                Cesium.Math.toRadians(centerLat)
            )
        ),
        height: Math.max(
            10000,
            (north - south) * 110540
        ),
        maxDepth: 500
    };

    const modelContainer =
        document.getElementById("modelContainer");

    const modelTitle =
        document.getElementById("modelViewerTitle");

    if (modelContainer) {
        modelContainer.style.display = "block";
    }

    if (modelTitle) {
        modelTitle.style.display = "block";
    }

    clear3DModel();
    create3DRegionBox(bounds);
    update3DInformation(0, bounds.maxDepth);
    focus3DRegion([], bounds);

    if (typeof loadThreeVolume === "function") {
        loadThreeVolume(bounds, []);
    } else if (typeof renderSampleVolume === "function") {
        renderSampleVolume([], bounds.maxDepth || 500);
    }
}



/* =========================================================
   DRAW SMALL-GLOBE POINTS
========================================================= */

function drawSelectedMapData() {
    // Globe is kept clean (only rectangle selection is shown on globe).
    // Argo floats and observation pointers are rendered exclusively in the 3D model.
}



/* =========================================================
   OBSERVATION CLICK
========================================================= */

function setupObservationClick() {

    if (
        observationClickHandler
    ) {

        observationClickHandler.destroy();
    }


    observationClickHandler =
        new Cesium.ScreenSpaceEventHandler(
            viewer.scene.canvas
        );


    observationClickHandler.setInputAction(

        click => {

            const picked =
                viewer.scene.pick(
                    click.position
                );


            if (
                !Cesium.defined(
                    picked
                ) ||
                !picked.id ||
                !picked.id.properties
            ) {
                return;
            }


            const property =
                picked.id.properties
                    .oceanData;


            if (!property) {
                return;
            }


            const row =
                property.getValue(
                    viewer.clock.currentTime
                );


            showObservation(
                row
            );
        },

        Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
}


/* =========================================================
   CENTER MODEL CLICK
========================================================= */

function setupModelObservationClick() {

    if (
        !modelViewer
    ) {
        return;
    }


    if (
        modelClickHandler
    ) {

        modelClickHandler.destroy();
    }


    modelClickHandler =
        new Cesium.ScreenSpaceEventHandler(
            modelViewer.scene.canvas
        );


    modelClickHandler.setInputAction(

        click => {

            const picked =
                modelViewer.scene.pick(
                    click.position
                );


            if (
                !Cesium.defined(
                    picked
                ) ||
                !picked.id ||
                !picked.id.properties
            ) {
                return;
            }


            const property =
                picked.id.properties
                    .oceanData;


            if (!property) {
                return;
            }


            const row =
                property.getValue(
                    modelViewer.clock.currentTime
                );


            showObservation(
                row
            );
        },

        Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
}


/* =========================================================
   DESCRIPTION
========================================================= */

function createDescription(row) {

    return `

        <div style="
            font-family: Arial;
            padding: 12px;
            min-width: 250px;
        ">

            <h3>
                Ocean Observation
            </h3>

            <hr>

            <b>Temperature:</b>
            ${
                Number.isFinite(
                    row.temperature
                )
                ?
                row.temperature.toFixed(2)
                + " °C"
                :
                "N/A"
            }

            <br><br>

            <b>Salinity:</b>
            ${
                Number.isFinite(
                    row.salinity
                )
                ?
                row.salinity.toFixed(3)
                + " PSU"
                :
                "N/A"
            }

            <br><br>

            <b>Pressure:</b>
            ${
                Number.isFinite(
                    row.pressure
                )
                ?
                row.pressure.toFixed(2)
                + " m"
                :
                "N/A"
            }

            <br><br>

            <b>Latitude:</b>
            ${formatValue(row.latitude, 5)}

            <br>

            <b>Longitude:</b>
            ${formatValue(row.longitude, 5)}

        </div>
    `;
}


/* =========================================================
   MODEL COORDINATE SYSTEM
========================================================= */

function getModelBounds(data) {

    const longitudes =
        data
            .map(
                row =>
                    Number(
                        row.longitude
                    )
            )
            .filter(
                Number.isFinite
            );


    const latitudes =
        data
            .map(
                row =>
                    Number(
                        row.latitude
                    )
            )
            .filter(
                Number.isFinite
            );


    const depths =
        data
            .map(
                row =>
                    Number(
                        row.pressure
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    ) &&
                    value >= 0
            );


    if (
        !longitudes.length ||
        !latitudes.length
    ) {

        return null;
    }


    const west =
        Math.min(
            ...longitudes
        );


    const east =
        Math.max(
            ...longitudes
        );


    const south =
        Math.min(
            ...latitudes
        );


    const north =
        Math.max(
            ...latitudes
        );


    const centerLon =
        (west + east) / 2;


    const centerLat =
        (south + north) / 2;


    const maxDepth =
        depths.length
            ?
            Math.max(
                ...depths
            )
            :
            500;


    /*
       Give very small selections
       a visible width.
    */

    const width =
        Math.max(
            10000,
            (east - west) *
            111320 *
            Math.cos(
                Cesium.Math.toRadians(
                    centerLat
                )
            )
        );


    const height =
        Math.max(
            10000,
            (north - south) *
            110540
        );


    return {

        west,
        east,

        south,
        north,

        centerLon,
        centerLat,

        width,
        height,

        maxDepth:
            Math.max(
                20,
                maxDepth
            )
    };
}


/* =========================================================
   CREATE LOCAL ENU POSITION
========================================================= */

function toLocalModelPosition(
    row,
    bounds
) {

    const origin =
        Cesium.Cartesian3.fromDegrees(
            bounds.centerLon,
            bounds.centerLat,
            0
        );

    const transform =
        Cesium.Transforms.eastNorthUpToFixedFrame(
            origin
        );

    const localX =
        (
            Number(
                row.longitude
            ) -
            bounds.centerLon
        ) *
        111320 *
        Math.cos(
            Cesium.Math.toRadians(
                bounds.centerLat
            )
        );


    const localY =
        (
            Number(
                row.latitude
            ) -
            bounds.centerLat
        ) *
        110540;


    let depth =
        Number(
            row.pressure
        );


    if (
        !Number.isFinite(
            depth
        )
    ) {

        depth = 0;
    }


    depth =
        Math.max(
            0,
            depth
        );


    const local =
        new Cesium.Cartesian3(
            localX,
            localY,
            -depth
        );


    return Cesium.Matrix4.multiplyByPoint(
        transform,
        local,
        new Cesium.Cartesian3()
    );
}


/* =========================================================
   CREATE 3D OCEAN MODEL
========================================================= */
function createOcean3DModel(data) {

    if (!modelViewer || !data || !data.length) {
        console.log("No data available for 3D model.");
        return;
    }

    console.log("Creating 3D model with:", data.length, "points");

    // SHOW CENTER 3D MODEL
    const modelContainer =
        document.getElementById("modelContainer");

    const modelTitle =
        document.getElementById("modelViewerTitle");

    if (modelContainer) {
        modelContainer.style.display = "block";
    }

    if (
        modelViewer &&
        typeof modelViewer.resize === "function"
    ) {
        modelViewer.resize();
    }

    if (modelTitle) {
        modelTitle.style.display = "block";
    }

    modelAutoRotate = false;

    // Remove previous model
    clear3DModel();

    // Calculate selected region bounds
    const bounds = getModelBounds(data);

    if (!bounds) {
        console.log("Could not calculate model bounds.");
        return;
    }

    currentModelBounds = bounds;

    loadThreeVolume(
        bounds,
        data
    );

    console.log("3D bounds:", bounds);

    // Limit number of points
    const dataFor3D =
        limitData(data, MAX_3D_POINTS);

    console.log(
        "Points used for 3D:",
        dataFor3D.length
    );

    // Create observation points
    dataFor3D.forEach((row, index) => {

        create3DObservation(
            row,
            index,
            bounds
        );

    });

    // Create vertical profiles
    createDepthProfiles(
        dataFor3D,
        bounds
    );

    // Create surrounding 3D region
    create3DRegionBox(
        bounds
    );

    // Update information
    update3DInformation(
        data.length,
        bounds.maxDepth
    );

    // Move camera to selected model
    focus3DRegion(
        dataFor3D,
        bounds
    );

    // Force rendering
    modelViewer.scene.requestRender();

    console.log(
        "3D model created successfully."
    );
}

/* =========================================================
   3D OBSERVATION POINT
========================================================= */

function create3DObservation(
    row,
    index,
    bounds
) {

    const position =
        toLocalModelPosition(
            row,
            bounds
        );


    const entity =
        modelViewer.entities.add({

            name:
                `Observation ${index + 1}`,

            position,

            point: {
                pixelSize: 16,
                color: getParameterColor(row, currentParameter),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },


            description:
                createDescription(
                    row
                ),

            properties:
                new Cesium.PropertyBag({

                    oceanData:
                        row
                })
        });


    modelEntities.push(
        entity
    );
}


/* =========================================================
   DEPTH PROFILE
========================================================= */

function createDepthProfiles(
    data,
    bounds
) {

    const groups = {};


    data.forEach(
        row => {

            const platform =
                getColumn(
                    row.original,
                    [
                        "platform",
                        "platform_id",
                        "wmo",
                        "profiler_code",
                        "cycle_number",
                        "cycle"
                    ]
                );


            if (!platform) {
                return;
            }


            if (
                !groups[platform]
            ) {

                groups[platform] =
                    [];
            }


            groups[platform].push(
                row
            );
        }
    );


    Object.values(
        groups
    ).forEach(
        rows => {

            if (
                rows.length < 2
            ) {
                return;
            }


            rows.sort(
                (a, b) =>
                    (
                        Number(
                            a.pressure
                        ) || 0
                    ) -
                    (
                        Number(
                            b.pressure
                        ) || 0
                    )
            );


            const positions =
                rows.map(
                    row =>
                        toLocalModelPosition(
                            row,
                            bounds
                        )
                );


            if (
                positions.length < 2
            ) {
                return;
            }


            const line =
                modelViewer.entities.add({

                    polyline: {

                        positions,

                        width: 2,

                        material:
                            Cesium.Color.WHITE
                                .withAlpha(
                                    0.5
                                )
                    }
                });


            modelEntities.push(
                line
            );
        }
    );
}


/* =========================================================
   CREATE SELECTED OCEAN VOLUME
========================================================= */

function create3DRegionBox(
    bounds
) {

    /*
       Main transparent volume.
    */

    const center =
        Cesium.Cartesian3.fromDegrees(
            bounds.centerLon,
            bounds.centerLat,
            -bounds.maxDepth / 2
        );


    const volume =
        modelViewer.entities.add({

            name:
                "Selected Ocean Volume",

            position:
                center,

            box: {

                dimensions:
                    new Cesium.Cartesian3(
                        bounds.width,
                        bounds.height,
                        bounds.maxDepth
                    ),

                material:
                    Cesium.Color.fromCssColorString(
                        "#0877bd"
                    ).withAlpha(
                        0.18
                    ),

                outline:
                    true,

                outlineColor:
                    Cesium.Color.fromCssColorString(
                        "#72eaff"
                    ).withAlpha(
                        0.8
                    )
            }
        });


    modelEntities.push(
        volume
    );


    /*
       Surface.
    */

    const surface =
        modelViewer.entities.add({

            name:
                "Selected Ocean Surface",

            position:
                Cesium.Cartesian3.fromDegrees(
                    bounds.centerLon,
                    bounds.centerLat,
                    0
                ),

            box: {

                dimensions:
                    new Cesium.Cartesian3(
                        bounds.width,
                        bounds.height,
                        Math.max(
                            10,
                            bounds.maxDepth *
                            0.01
                        )
                    ),

                material:
                    Cesium.Color.fromCssColorString(
                        "#087dcc"
                    ).withAlpha(
                        0.6
                    ),

                outline:
                    true,

                outlineColor:
                    Cesium.Color.WHITE
                        .withAlpha(
                            0.7
                        )
            }
        });


    modelEntities.push(
        surface
    );


    /*
       Horizontal layers.

       These give the model the
       appearance of an ocean slice.
    */

    const layerCount = 14;


    for (
        let i = 1;
        i < layerCount;
        i++
    ) {

        const depth =
            (
                bounds.maxDepth *
                i
            ) /
            layerCount;


        const layer =
            modelViewer.entities.add({

                name:
                    `Depth Layer ${depth.toFixed(0)} m`,

                    position:
                    Cesium.Cartesian3.fromDegrees(
                        bounds.centerLon,
                        bounds.centerLat,
                        -depth
                    ),

                box: {

                    dimensions:
                        new Cesium.Cartesian3(
                            bounds.width,
                            bounds.height,
                            Math.max(
                                4,
                                bounds.maxDepth /
                                250
                            )
                        ),

                    material:
                        Cesium.Color.fromHsl(
                            0.58 -
                            (
                                i /
                                layerCount
                            ) *
                            0.20,

                            0.85,

                            0.48,

                            0.35
                        ),

                    outline:
                        false
                }
            });


        modelEntities.push(
            layer
        );
    }


    /*
       Bottom / seafloor.
    */

    const floor =
        modelViewer.entities.add({

            name:
                "Selected Ocean Floor",

            position:
                Cesium.Cartesian3.fromDegrees(
                    bounds.centerLon,
                    bounds.centerLat,
                    -bounds.maxDepth
                ),

            box: {

                dimensions:
                    new Cesium.Cartesian3(
                        bounds.width,
                        bounds.height,
                        Math.max(
                            15,
                            bounds.maxDepth *
                            0.015
                        )
                    ),

                material:
                    Cesium.Color.fromCssColorString(
                        "#24394a"
                    ).withAlpha(
                        0.95
                    ),

                outline:
                    true,

                outlineColor:
                    Cesium.Color.GRAY
                        .withAlpha(
                            0.8
                        )
            }
        });


    modelEntities.push(
        floor
    );

    const sandDepth = Math.max(20, bounds.maxDepth * 0.72);
    const sand = modelViewer.entities.add({
        name: "Selected Sand Layer",
        position: Cesium.Cartesian3.fromDegrees(
            bounds.centerLon,
            bounds.centerLat,
            -sandDepth
        ),
        box: {
            dimensions: new Cesium.Cartesian3(
                bounds.width * 0.94,
                bounds.height * 0.94,
                Math.max(18, bounds.maxDepth * 0.12)
            ),
            material: Cesium.Color.fromCssColorString("#b8874b").withAlpha(0.95),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#e0b56d")
        }
    });
    modelEntities.push(sand);

    const rockCount = 7;
    for (let index = 0; index < rockCount; index++) {
        const angle = (Math.PI * 2 * index) / rockCount;
        const longitudeOffset = (bounds.width * 0.28 * Math.cos(angle)) /
            (111320 * Math.max(0.2, Math.cos(Cesium.Math.toRadians(bounds.centerLat))));
        const latitudeOffset = (bounds.height * 0.28 * Math.sin(angle)) / 110540;
        const radius = Math.max(18, Math.min(bounds.width, bounds.height) * (0.035 + (index % 3) * 0.012));
        const rock = modelViewer.entities.add({
            name: `Seafloor Rock ${index + 1}`,
            position: Cesium.Cartesian3.fromDegrees(
                bounds.centerLon + longitudeOffset,
                bounds.centerLat + latitudeOffset,
                -bounds.maxDepth * 0.9 + radius * 0.35
            ),
            ellipsoid: {
                radii: new Cesium.Cartesian3(radius * 1.35, radius, radius * 0.8),
                material: Cesium.Color.fromCssColorString("#5b5145"),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString("#9c8c72")
            }
        });
        modelEntities.push(rock);
    }
}


/* =========================================================
   FOCUS CENTER MODEL
========================================================= */
function focus3DRegion(data, bounds) {

    if (!modelViewer || !bounds) {
        return;
    }

    const distance = Math.max(
        bounds.width,
        bounds.height,
        bounds.maxDepth,
        1000
    ) * 2.4;

    modelOrbitTransform =
        Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.fromDegrees(
                bounds.centerLon,
                bounds.centerLat,
                -bounds.maxDepth / 2
            )
        );

    modelOrbitDistance = distance;
    modelOrbitAngle = Cesium.Math.toRadians(35);
    modelAutoRotate = false;

    modelViewer.camera.lookAtTransform(
        modelOrbitTransform,
        new Cesium.Cartesian3(
            Math.cos(modelOrbitAngle) * distance,
            Math.sin(modelOrbitAngle) * distance,
            distance * 0.55
        )
    );

    modelViewer.scene.requestRender();
}


/* =========================================================
   DEPTH SLIDER
========================================================= */

function updateDepthVisualization() {

    if (
        !selectedOceanData.length
    ) {
        return;
    }


    const filtered =
        selectedOceanData.filter(
            row => {

                const depth =
                    Number(
                        row.pressure
                    );


                return (
                    Number.isFinite(
                        depth
                    ) &&
                    depth <=
                    depthLimit
                );
            }
        );


    if (
        !filtered.length
    ) {

        clear3DModel();

        updateSourceStatus(
            "No observations at this depth."
        );

        return;
    }


    createOcean3DModel(
        filtered
    );


    updateStatistics(
        filtered
    );


    updateSourceStatus(
        `${filtered.length.toLocaleString()} observations visible to ${depthLimit.toFixed(0)} m.`
    );
}


/* =========================================================
   PARAMETER
========================================================= */

function getParameterValue(
    row,
    parameter
) {

    const value =
        Number(
            row[parameter]
        );


    return Number.isFinite(
        value
    )
        ? value
        : NaN;
}


/* =========================================================
   PARAMETER COLOR
========================================================= */

function getParameterColor(
    row,
    parameter
) {

    const value =
        getParameterValue(
            row,
            parameter
        );


    if (
        !Number.isFinite(
            value
        )
    ) {

        return Cesium.Color.WHITE;
    }


    const range =
        getParameterRange(
            parameter
        );


    if (!range) {

        return Cesium.Color.CYAN;
    }


    let normalized = 0.5;


    if (
        range.max !==
        range.min
    ) {

        normalized =
            (
                value -
                range.min
            ) /
            (
                range.max -
                range.min
            );
    }


    normalized =
        Math.max(
            0,
            Math.min(
                1,
                normalized
            )
        );


    /*
       Blue -> cyan -> yellow -> red
    */

    return Cesium.Color.fromHsl(
        0.66 -
        normalized *
        0.66,

        0.9,

        0.5,

        1
    );
}


/* =========================================================
   PARAMETER RANGE
========================================================= */

function getParameterRange(
    parameter
) {

    if (
        !selectedOceanData.length
    ) {
        return null;
    }


    const values =
        selectedOceanData
            .map(
                row =>
                    getParameterValue(
                        row,
                        parameter
                    )
            )
            .filter(
                Number.isFinite
            );


    if (!values.length) {
        return null;
    }


    return {

        min:
            Math.min(
                ...values
            ),

        max:
            Math.max(
                ...values
            )
    };
}


/* =========================================================
   CHANGE PARAMETER
========================================================= */

function changeParameter(
    parameter
) {

    currentParameter =
        parameter;


    updateLegend();


    if (
        selectedOceanData.length
    ) {

        drawSelectedMapData();

        createOcean3DModel(
            selectedOceanData
        );
    }
}


/* =========================================================
   LEGEND
========================================================= */

function updateLegend() {

    const info =
        PARAMETER_INFO[
            currentParameter
        ];


    if (!info) {
        return;
    }


    const title =
        document.getElementById(
            "legendTitle"
        );


    const unit =
        document.getElementById(
            "legendUnit"
        );


    if (title) {

        title.textContent =
            info.title;
    }


    if (unit) {

        unit.textContent =
            info.unit;
    }


    const range =
        getParameterRange(
            currentParameter
        );


    const min =
        document.getElementById(
            "legendMin"
        );


    const max =
        document.getElementById(
            "legendMax"
        );


    if (!range) {

        if (min)
            min.textContent = "--";

        if (max)
            max.textContent = "--";

        return;
    }


    if (min) {

        min.textContent =
            formatValue(
                range.min
            );
    }


    if (max) {

        max.textContent =
            formatValue(
                range.max
            );
    }
}


/* =========================================================
   OBSERVATION INFORMATION
========================================================= */

function showObservation(
    row
) {

    if (!row) {
        return;
    }


    const panel =
        document.getElementById(
            "observationPanel"
        );


    if (!panel) {
        return;
    }


    const temperature =
        document.getElementById(
            "obsTemperature"
        );


    const salinity =
        document.getElementById(
            "obsSalinity"
        );


    const pressure =
        document.getElementById(
            "obsPressure"
        );


    const latitude =
        document.getElementById(
            "obsLatitude"
        );


    const longitude =
        document.getElementById(
            "obsLongitude"
        );

    const source =
        document.getElementById(
            "obsSource"
        );

    const platform =
        document.getElementById(
            "obsPlatform"
        );

    const oxygen =
        document.getElementById(
            "obsOxygen"
        );

    const conductivity =
        document.getElementById(
            "obsConductivity"
        );


    if (temperature) {

        temperature.textContent =
            Number.isFinite(
                row.temperature
            )
                ?
                `${row.temperature.toFixed(2)} °C`
                :
                "--";
    }


    if (salinity) {

        salinity.textContent =
            Number.isFinite(
                row.salinity
            )
                ?
                `${row.salinity.toFixed(3)} PSU`
                :
                "--";
    }


    if (pressure) {

        pressure.textContent =
            Number.isFinite(
                row.pressure
            )
                ?
                `${row.pressure.toFixed(2)} m`
                :
                "--";
    }


    if (latitude) {

        latitude.textContent =
            formatValue(
                row.latitude,
                5
            ) + "°";
    }


    if (longitude) {

        longitude.textContent =
            formatValue(
                row.longitude,
                5
            ) + "°";
    }

    if (source) {
        source.textContent = getSourceName(row.original || row).toUpperCase();
    }

    if (platform) {
        platform.textContent = getColumn(row.original || row, [
            "platform_id",
            "platform",
            "wmo",
            "profiler_code",
            "id"
        ]) || "--";
    }

    if (oxygen) {
        oxygen.textContent = Number.isFinite(row.oxygen)
            ? `${row.oxygen.toFixed(2)} µmol/kg`
            : "--";
    }

    if (conductivity) {
        const value = Number(row.original?.conductivity);
        conductivity.textContent = Number.isFinite(value)
            ? `${value.toFixed(3)} S/m`
            : "--";
    }


    panel.classList.add(
        "visible"
    );
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics(
    data
) {

    if (
        !data ||
        !data.length
    ) {
        return;
    }


    const values =
        data
            .map(
                row =>
                    getParameterValue(
                        row,
                        currentParameter
                    )
            )
            .filter(
                Number.isFinite
            );


    const depths =
        data
            .map(
                row =>
                    Number(
                        row.pressure
                    )
            )
            .filter(
                Number.isFinite
            );


    const count =
        document.getElementById(
            "dataCount"
        );


    if (count) {

        count.textContent =
            data.length.toLocaleString();
    }


    const maxDepth =
        document.getElementById(
            "maxDepth"
        );


    if (maxDepth) {

        maxDepth.textContent =
            depths.length
                ?
                `${Math.max(...depths).toFixed(0)} m`
                :
                "--";
    }


    if (values.length) {

        const min =
            Math.min(
                ...values
            );


        const max =
            Math.max(
                ...values
            );


        const average =
            values.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            values.length;


        const minElement =
            document.getElementById(
                "minValue"
            );


        const maxElement =
            document.getElementById(
                "maxValue"
            );


        const averageElement =
            document.getElementById(
                "averageValue"
            );


        if (minElement)
            minElement.textContent =
                formatValue(min);


        if (maxElement)
            maxElement.textContent =
                formatValue(max);


        if (averageElement)
            averageElement.textContent =
                formatValue(average);
    }
}


/* =========================================================
   REGION INFORMATION
========================================================= */

function updateRegionInformation(
    west,
    east,
    south,
    north
) {

    const element =
        document.getElementById(
            "selectedRegion"
        );


    if (!element) {
        return;
    }


    element.innerHTML =

        `<b>${south.toFixed(2)}°</b> – ` +
        `<b>${north.toFixed(2)}°</b> latitude<br>` +

        `<b>${west.toFixed(2)}°</b> – ` +
        `<b>${east.toFixed(2)}°</b> longitude`;
}


/* =========================================================
   3D INFORMATION
========================================================= */

function update3DInformation(
    count,
    depth
) {

    const element =
        document.getElementById(
            "modelStatus"
        );


    if (element) {

        element.textContent =
            `${count.toLocaleString()} observations | ` +
            `Depth: ${depth.toFixed(0)} m`;
    }


    const state =
        document.getElementById(
            "modelState"
        );


    if (state) {

        state.textContent =
            "GENERATED";
    }
}


/* =========================================================
   CLEAR MAP
========================================================= */

function clearOceanEntities() {

    if (!viewer) {
        return;
    }


    oceanEntities.forEach(
        entity => {

            try {

                viewer.entities.remove(
                    entity
                );

            }
            catch (error) {

                console.warn(
                    error
                );
            }
        }
    );


    oceanEntities = [];
}


/* =========================================================
   CLEAR 3D MODEL
========================================================= */

function clear3DModel() {

    if (!modelViewer) {
        return;
    }


    modelEntities.forEach(
        entity => {

            try {

                modelViewer.entities.remove(
                    entity
                );

            }
            catch (error) {

                console.warn(
                    error
                );
            }
        }
    );


    modelEntities = [];


    currentModelBounds =
        null;
}


/* =========================================================
   CLEAR SELECTION
========================================================= */

function clearSelectionRectangle() {

    if (
        viewer &&
        selectionRectangle
    ) {

        try {

            viewer.entities.remove(
                selectionRectangle
            );

        }
        catch (error) {

            console.warn(
                error
            );
        }
    }


    selectionRectangle =
        null;
}


/* =========================================================
   RESET
========================================================= */

function resetWorld() {

    selectedOceanData =
        [];


    clearOceanEntities();

    clear3DModel();

    clearSelectionRectangle();


    selectionStart =
        null;

    selectionEnd =
        null;


    depthLimit =
        Infinity;


    updateCount(0);


    const region =
        document.getElementById(
            "selectedRegion"
        );


    if (region) {

        region.textContent =
            "No region selected";
    }


    const modelStatus =
        document.getElementById(
            "modelStatus"
        );


    if (modelStatus) {

        modelStatus.textContent =
            "Waiting for region selection";
    }


    const modelState =
        document.getElementById(
            "modelState"
        );


    if (modelState) {

        modelState.textContent =
            "NOT GENERATED";
    }


    const panel =
        document.getElementById(
            "observationPanel"
        );


    if (panel) {

        panel.classList.remove(
            "visible"
        );
    }


    setSystemStatus(
        "DATA READY"
    );


    updateSourceStatus(
        "Select an ocean region."
    );
}


/* =========================================================
   LIMIT DATA
========================================================= */

function limitData(
    data,
    maximum
) {

    if (
        data.length <=
        maximum
    ) {

        return data;
    }


    const step =
        Math.ceil(
            data.length /
            maximum
        );


    return data.filter(
        (
            row,
            index
        ) =>
            index % step === 0
    );
}


/* =========================================================
   FORMAT
========================================================= */

function formatValue(
    value,
    decimals = 2
) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "--";
    }


    return Number(value)
        .toFixed(
            decimals
        );
}


/* =========================================================
   COUNT
========================================================= */

function updateCount(
    count
) {

    const ids = [

        "dataCount",

        "recordCount",

        "selectedCount",

        "observationCount"
    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.textContent =
                    Number(
                        count
                    ).toLocaleString();
            }
        }
    );
}


/* =========================================================
   STATUS
========================================================= */

function updateSourceStatus(
    message
) {

    const ids = [

        "sourceStatus",

        "dataStatus",

        "statusMessage"
    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.textContent =
                    message;
            }
        }
    );
}


function setSystemStatus(
    message
) {

    const ids = [

        "systemStatus",

        "statusText"
    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.textContent =
                    message;
            }
        }
    );
}


function setCSVIndicator(
    state
) {

    const element =
        document.getElementById(
            "csvIndicator"
        );


    if (!element) {
        return;
    }


    element.classList.remove(
        "loading",
        "ready",
        "error"
    );


    element.classList.add(
        state
    );
}


function showStatus(
    message
) {

    updateSourceStatus(
        message
    );


    const element =
        document.getElementById(
            "selectionStatus"
        );


    if (element) {

        element.textContent =
            message;
    }
}


/* =========================================================
   ROTATION
========================================================= */

let isRotating = false;


function toggleRotation() {

    isRotating =
        !isRotating;


    const button =
        document.getElementById(
            "rotateBtn"
        );


    if (button) {

        button.classList.toggle(
            "active",
            isRotating
        );
    }
}


function rotateGlobe() {

    if (
        viewer &&
        isRotating &&
        !isSelecting
    ) {

        viewer.camera.rotateRight(
            Cesium.Math.toRadians(
                0.03
            )
        );
    }


    requestAnimationFrame(
        rotateGlobe
    );
}


/* =========================================================
   ZOOM
========================================================= */

function zoomIn() {

    if (!viewer) {
        return;
    }


    viewer.camera.zoomIn(
        viewer.camera.positionCartographic
            .height * 0.25
    );
}


function zoomOut() {

    if (!viewer) {
        return;
    }


    viewer.camera.zoomOut(
        viewer.camera.positionCartographic
            .height * 0.25
    );
}


/* =========================================================
   HOME
========================================================= */

function homeView() {

    if (!viewer) {
        return;
    }


    viewer.camera.setView({

        destination:
            Cesium.Cartesian3.fromDegrees(
                78,
                15,
                22000000
            )
    });
}


/* =========================================================
   SCENE MODE
========================================================= */

function setSceneMode(
    mode
) {

    if (!viewer) {
        return;
    }


    if (
        mode === "3d"
    ) {

        viewer.scene.morphTo3D(
            1
        );
    }

    else if (
        mode === "2d"
    ) {

        viewer.scene.morphTo2D(
            1
        );
    }

    else if (
        mode === "cv"
    ) {

        viewer.scene.morphToColumbusView(
            1
        );
    }
}


/* =========================================================
   MODEL TITLE
========================================================= */

function updateModelTitle() {

    const element =
        document.getElementById(
            "modelViewerTitle"
        );


    if (!element) {
        return;
    }


    const label =
        PARAMETER_INFO[
            currentParameter
        ]?.title ||
        currentParameter
            .toUpperCase();


    element.textContent =
        `SELECTED OCEAN 3D MODEL — ${label}`;
}


/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {

    /*
       Parameter selector
    */

    const parameterSelector =
        document.getElementById(
            "parameterSelector"
        );


    if (parameterSelector) {

        parameterSelector.addEventListener(
            "change",
            event => {

                changeParameter(
                    event.target.value
                );
            }
        );
    }


    /*
       Reset
    */

    const resetButton =
        document.getElementById(
            "resetButton"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetWorld
        );
    }


    /*
       Clear
    */

    const clearButton =
        document.getElementById(
            "clearButton"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            resetWorld
        );
    }


    /*
       Rotate
    */

    const rotateButton =
        document.getElementById(
            "rotateBtn"
        );


    if (rotateButton) {

        rotateButton.addEventListener(
            "click",
            toggleRotation
        );
    }


    /*
       Zoom
    */

    const zoomInButton =
        document.getElementById(
            "zoomInBtn"
        );


    if (zoomInButton) {

        zoomInButton.addEventListener(
            "click",
            zoomIn
        );
    }


    const zoomOutButton =
        document.getElementById(
            "zoomOutBtn"
        );


    if (zoomOutButton) {

        zoomOutButton.addEventListener(
            "click",
            zoomOut
        );
    }


    /*
       Home
    */

    const homeButton =
        document.getElementById(
            "homeBtn"
        );


    if (homeButton) {

        homeButton.addEventListener(
            "click",
            homeView
        );
    }


    /*
       Scene
    */

    const scene3D =
        document.getElementById(
            "3dBtn"
        );


    if (scene3D) {

        scene3D.addEventListener(
            "click",
            () =>
                setSceneMode("3d")
        );
    }


    const scene2D =
        document.getElementById(
            "2dBtn"
        );


    if (scene2D) {

        scene2D.addEventListener(
            "click",
            () =>
                setSceneMode("2d")
        );
    }


    const sceneCV =
        document.getElementById(
            "cvBtn"
        );


    if (sceneCV) {

        sceneCV.addEventListener(
            "click",
            () =>
                setSceneMode("cv")
        );
    }


    /*
       ARGO / GLIDER / MODEL
    */

    const datasetOptions =
        document.querySelectorAll(
            'input[name="dataSource"]'
        );


    datasetOptions.forEach(
        option => {

            option.addEventListener(
                "change",
                event => {

                    selectedDataSource =
                        event.target.value;

                    const label =
                        document.getElementById(
                            "selectedDataSource"
                        );

                    if (label) {
                        label.textContent =
                            selectedDataSource
                                .toUpperCase();
                    }

                    if (typeof hide3DCalloutData === "function") {
                        hide3DCalloutData();
                    }

                    const modelContainer = document.getElementById("modelContainer");
                    const isModelVisible = modelContainer && modelContainer.style.display !== "none";

                    if (selectionStart && selectionEnd) {
                        selectOceanRegion();
                    } else if (isModelVisible) {
                        if (typeof renderSampleVolume === "function") {
                            renderSampleVolume([], 500);
                        }
                    } else {
                        resetWorld();
                    }

                    updateSourceStatus(
                        `${selectedDataSource.toUpperCase()} dataset active. Float positions updated.`
                    );
                }
            );
        }
    );


    /*
       Select Region
    */

    const selectButton =
        document.getElementById(
            "selectRegionBtn"
        );


    if (selectButton) {

        selectButton.addEventListener(
            "click",
            () => {

                selectionMode =
                    !selectionMode;


                if (
                    selectionMode
                ) {

                    selectButton.textContent =
                        "✖ Stop Selecting";


                    selectButton.classList.add(
                        "active"
                    );


                    showStatus(
                        "Drag a rectangle on the small globe."
                    );

                }

                else {

                    selectButton.textContent =
                        "📍 Select Region";


                    selectButton.classList.remove(
                        "active"
                    );


                    showStatus(
                        "Region selection stopped."
                    );
                }
            }
        );
    }


    /*
       Clear selection
    */

    const clearSelection =
        document.getElementById(
            "clearSelection"
        );


    if (clearSelection) {

        clearSelection.addEventListener(
            "click",
            () => {

                selectionMode =
                    false;


                if (selectButton) {

                    selectButton.textContent =
                        "📍 Select Region";

                    selectButton.classList.remove(
                        "active"
                    );
                }


                resetWorld();
            }
        );
    }


    /*
       Depth
    */

    const depthSlider =
        document.getElementById(
            "depthSlider"
        );


    if (depthSlider) {

        depthSlider.addEventListener(
            "input",
            event => {

                depthLimit =
                    Number(
                        event.target.value
                    );


                const depthValue =
                    document.getElementById(
                        "depthValue"
                    );


                if (depthValue) {

                    depthValue.textContent =
                        `${depthLimit.toFixed(0)} m`;
                }


                updateDepthVisualization();
            }
        );
    }
}


/* =========================================================
   PARAMETER BUTTONS
========================================================= */

function setupParameterButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-parameter]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const parameter =
                        button.dataset.parameter;


                    if (!parameter) {
                        return;
                    }


                    changeParameter(
                        parameter
                    );


                    buttons.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeApp() {

    try {

        setSystemStatus(
            "INITIALIZING"
        );


        createViewer();

        /* 3D model stays hidden until user selects a region */


        setupButtons();


        setupParameterButtons();


        updateLegend();


        updateModelTitle();


        await loadOceanData();


        setSystemStatus(
            "DATA READY"
        );


        rotateGlobe();

    }

    catch (error) {

        console.error(
            "Initialization error:",
            error
        );


        setSystemStatus(
            "INITIALIZATION ERROR"
        );


        updateSourceStatus(
            "Application failed to initialize. Check browser console."
        );
    }
}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

}

else {

    initializeApp();
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.changeParameter =
    changeParameter;

window.resetWorld =
    resetWorld;

window.selectOceanRegion =
    selectOceanRegion;

window.setupWorldSelection =
    setupWorldSelection;

window.clear3DModel =
    clear3DModel;

window.zoomIn =
    zoomIn;

window.zoomOut =
    zoomOut;

window.homeView =
    homeView;

window.toggleRotation =
    toggleRotation;