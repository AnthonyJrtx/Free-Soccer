let controllerIndex = null;

window.addEventListener('gamepadconnected', (event) => {
    console.log("Mando conectado:", event.gamepad);
    controllerIndex = event.gamepad.index;
});

window.addEventListener('gamepaddisconnected', (event) => {
    console.log("Mando desconectado.");
    controllerIndex = null;
});

function checkGamepad() {
    if (controllerIndex !== null) {
        const gamepad = navigator.getGamepads()[controllerIndex];
        // Lógica de PES (aproximada)
        // Botón 0 (A en Xbox) = Aceptar/Pase
        // Botón 1 (B en Xbox) = Cancelar/Tiro
        // Botón 2 (X en Xbox) = Pase en profundidad
        // Botón 3 (Y en Xbox) = Pase bombeado
        
        if (gamepad.buttons[0].pressed) {
            console.log("Botón A presionado");
        }
        if (gamepad.buttons[1].pressed) {
            console.log("Botón B presionado");
        }
        
        // Para los sticks (ejes)
        const stickLeftX = gamepad.axes[0];
        const stickLeftY = gamepad.axes[1];

        if (stickLeftY < -0.5) {
            console.log("Mover arriba");
        } else if (stickLeftY > 0.5) {
            console.log("Mover abajo");
        }
    }
}

// Debes llamar a checkGamepad() en un bucle de animación para que se actualice constantemente
// function gameLoop() {
//     checkGamepad();
//     requestAnimationFrame(gameLoop);
// }
// gameLoop();