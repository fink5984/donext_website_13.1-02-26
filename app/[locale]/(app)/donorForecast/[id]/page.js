"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DonorForecastPage() {
    const router = useRouter();
    
    useEffect(() => {
        // ניתוב לעמוד הצפי הרגיל - המזהה יגיע מהקונטקסט
        router.replace('/donorForecast/');
    }, [router]);
    
    return <div>מפנה...</div>;
} 