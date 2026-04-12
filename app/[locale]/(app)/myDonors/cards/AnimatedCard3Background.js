import { useEffect, useState } from "react";

const colors = [
    "var(--Text-able-Text, #0C4AD5)",
    "var(--Text-Default, #6E99EC)",
    "var(--Bg-Button-hover, #283680)",
    "var(--Gray-Blue-600, #3759D9)",
];

export default function AnimatedCard3Background() {
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotation((r) => r + 120); // כל פעם מוסיף 120 מעלות
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            style={{
                width: 1479.816,
                height: 1479.816,
                position: "absolute",
                top: "50%",
                left: "50%",
                filter: "blur(125px)",
                pointerEvents: "none",
                zIndex: -1,
                transition: "all 3s cubic-bezier(0.4,0,0.2,1)",
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
        >
            {colors.map((color, i) => (
                <div
                    key={i}
                    style={{
                        width: 739.908,
                        height: 739.908,
                        background: color,
                        position: "absolute",
                        left: i % 2 === 0 ? 0 : 739.908,
                        top: i < 2 ? 0 : 739.908,
                        transition: "background 3s cubic-bezier(0.4,0,0.2,1)",
                    }}
                />
            ))}
        </div>
    );
}
