"use client";

import { useState } from "react";
import AddEdit from "../AddEdit/AddEdit";
import Button from "@/app/components/Button";

export default function Home() {
  const [form, setForm] = useState(true)
  return (
    <>
      ברוכים הבאים למערכת ניהול קמפיינים
      {/* <Button onClick={() => setForm(true)} text="הוסף תורם" />
      <AddEdit isOpen={form} onClose={() => setForm(false)} onSubmitDonor={() => {
        setForm(false)
      }} /> */}
    </>
  );
}