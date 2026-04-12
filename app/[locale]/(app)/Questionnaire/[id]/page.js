"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const QuestionnairePage = () => {
    const router = useRouter();
    
    useEffect(() => {
        // ניתוב לעמוד השאלון הרגיל - המזהה יגיע מהקונטקסט
        router.replace('/Questionnaire/');
    }, [router]);
    
    return <div>מפנה...</div>;
};

export default QuestionnairePage;
