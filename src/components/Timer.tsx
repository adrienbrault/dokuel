import { useEffect, useRef, useState } from "react";

type TimerProps = {
	running: boolean;
	onTick?: (seconds: number) => void;
};

export function Timer({ running, onTick }: TimerProps) {
	const [seconds, setSeconds] = useState(0);
	const onTickRef = useRef(onTick);
	onTickRef.current = onTick;

	useEffect(() => {
		if (!running) return;
		const interval = setInterval(() => {
			setSeconds((s) => {
				const next = s + 1;
				onTickRef.current?.(next);
				return next;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [running]);

	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;

	return (
		<span className="font-mono text-sm text-gray-500 dark:text-gray-400 tabular-nums">
			{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
		</span>
	);
}
