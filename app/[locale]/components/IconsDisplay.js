"use client";

import React from "react";

export default function IconsDisplay() {
  return (
    <div className="flex gap-3 items-center" data-name="icons">
      <img
        loading="lazy"
        src="https://cdn.builder.io/api/v1/image/assets/24c30d1faba24666bcd96e611897f3b6/43fb260aae749da2d090919739986a811d93e73d8a87baf61bafabdcc350ee21?placeholderIfAbsent=true"
        className="object-contain shrink-0 self-stretch my-auto aspect-[2.03] w-[65px]"
        alt="Icon 1"
      />
      <img
        loading="lazy"
        src="https://cdn.builder.io/api/v1/image/assets/24c30d1faba24666bcd96e611897f3b6/93a6b4438bd2899a63ebd9183e35045261d4e6f0bb145d8b9bb7912d936ac24f?placeholderIfAbsent=true"
        className="object-contain shrink-0 self-stretch my-auto aspect-[2.36] w-[66px]"
        alt="Icon 2"
      />
    </div>
  );
}
