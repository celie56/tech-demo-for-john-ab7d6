var sendReq = (request) => { console.log("wasm Module not loaded"); }
var Module = {
    noInitialRun: true,
    print: console.log,
    printErr: console.log,
    onRuntimeInitialized() {
        console.log("wasm loaded");
        sendReq = (request) => {
            return Module.ccall(
                'run_json', 
				'string', 
				['string'], 
				[JSON.stringify(request)]
            );
        }
    }
};
