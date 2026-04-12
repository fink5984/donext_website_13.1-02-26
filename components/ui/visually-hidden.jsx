"use client"

import * as React from "react"

const VisuallyHidden = React.forwardRef(({ children, ...props }, ref) => (
  <span
    ref={ref}
    style={{
      position: "absolute",
      border: 0,
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      wordWrap: "normal",
    }}
    {...props}
  >
    {children}
  </span>
))
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
