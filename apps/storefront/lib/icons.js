import React from "react";
/* Inline icon set — exported on window.Icons. Each icon is a React functional component.
   Internally each icon is defined by an array of path/circle/rect descriptors. */
  function make(parts) {
    return function (props) {
      var size = props && props.size != null ? props.size : 18;
      var stroke = props && props.stroke != null ? props.stroke : 1.7;
      var className = props && props.className ? props.className : "";
      var style = props && props.style;
      var children = parts.map(function (p, i) {
        var tag = p[0];
        var attrs = Object.assign({ key: i }, p[1]);
        return React.createElement(tag, attrs);
      });
      return React.createElement(
        "svg",
        {
          width: size, height: size, viewBox: "0 0 24 24", fill: "none",
          stroke: "currentColor", strokeWidth: stroke,
          strokeLinecap: "round", strokeLinejoin: "round",
          className: className, style: style, "aria-hidden": "true",
        },
        children
      );
    };
  }
  // helper aliases
  function P(d)      { return ["path",   { d: d }]; }
  function C(x,y,r)  { return ["circle", { cx: x, cy: y, r: r }]; }
  function R(x,y,w,h,rx) { return ["rect", { x: x, y: y, width: w, height: h, rx: rx }]; }

  var Icons = {
    Search:      make([C(11,11,7), P("m20 20-3.5-3.5")]),
    Heart:       make([P("M20.42 4.58a5.4 5.4 0 0 0-7.64 0L12 5.36l-.79-.78a5.4 5.4 0 1 0-7.63 7.63l.79.79L12 20.61l7.63-7.63.79-.79a5.4 5.4 0 0 0 0-7.64Z")]),
    Bell:        make([P("M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"), P("M10.3 21a1.94 1.94 0 0 0 3.4 0")]),
    Cart:        make([C(8,21,1), C(19,21,1), P("M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12")]),
    User:        make([P("M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"), C(12,7,4)]),
    Globe:       make([C(12,12,10), P("M2 12h20"), P("M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z")]),
    ChevL:       make([P("m15 18-6-6 6-6")]),
    ChevR:       make([P("m9 18 6-6-6-6")]),
    ChevD:       make([P("m6 9 6 6 6-6")]),
    ArrowR:      make([P("M5 12h14"), P("m12 5 7 7-7 7")]),
    ArrowUR:     make([P("M7 17 17 7"), P("M7 7h10v10")]),
    Plus:        make([P("M12 5v14"), P("M5 12h14")]),
    Check:       make([P("M20 6 9 17l-5-5")]),
    ShieldCheck: make([P("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"), P("m9 12 2 2 4-4")]),
    Truck:       make([P("M14 18V6H1v12h2"), P("M3 18h12"), C(7,18,2), C(17,18,2), P("M15 8h4l4 4v6h-4")]),
    Clock:       make([C(12,12,10), P("M12 6v6l4 2")]),
    BadgeCheck:  make([P("M3.85 8.62a4 4 0 0 1 4.78-4.78 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.74Z"), P("m9 12 2 2 4-4")]),
    Package:     make([P("m7.5 4.27 9 5.15"), P("M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"), P("M3.3 7 12 12l8.7-5"), P("M12 22V12")]),
    Users:       make([P("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), C(9,7,4), P("M22 21v-2a4 4 0 0 0-3-3.87"), P("M16 3.13a4 4 0 0 1 0 7.75")]),
    Award:       make([C(12,8,6), P("M15.5 13 17 22l-5-3-5 3 1.5-9")]),
    Building:    make([P("M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"), P("M6 12h12"), P("M6 17h12"), P("M6 7h12")]),
    Sparkle:     make([P("M12 3v3m0 12v3M5 12H2m20 0h-3M5.6 5.6 3.5 3.5m17 17-2.1-2.1M5.6 18.4 3.5 20.5m17-17-2.1 2.1")]),
    Grid:        make([R(3,3,7,7,1), R(14,3,7,7,1), R(3,14,7,7,1), R(14,14,7,7,1)]),
    Help:        make([C(12,12,10), P("M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"), P("M12 17h.01")]),
    Pill:        make([P("M10.5 20.5 20 11a3.5 3.5 0 0 0 0-5L18 4a3.5 3.5 0 0 0-5 0L3.5 13.5a3.5 3.5 0 0 0 0 5L5.5 20.5a3.5 3.5 0 0 0 5 0Z"), P("m8.5 8.5 7 7")]),
    Snowflake:   make([P("M12 2v20"), P("M4.5 7 12 12l7.5-5"), P("M4.5 17 12 12l7.5 5"), P("M2 12h20")]),
    Beaker:      make([P("M4.5 3h15"), P("M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"), P("M6 14h12")]),
    Stethoscope: make([P("M11 2v3a3 3 0 1 1-6 0V2"), P("M8 8v3a6 6 0 0 0 6 6 6 6 0 0 0 6-6"), C(20,11,2)]),
    Syringe:     make([P("m18 2 4 4"), P("m17 7 3-3"), P("M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0L2.7 16.7a2.4 2.4 0 0 1 0-3.4L13 3l6 6Z"), P("M9 11l4 4")]),
    Baby:        make([P("M9 12h.01"), P("M15 12h.01"), P("M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"), P("M12 3a6 6 0 0 1 6 6c0 4-3 7-6 7s-6-3-6-7a6 6 0 0 1 6-6Z")]),
    Apple:       make([P("M12 6c-1.6-1.6-4-2-6-1-2 1-3 3-3 6 0 5 3 9 5 9s2-1 4-1 2 1 4 1 5-4 5-9c0-3-1-5-3-6-2-1-4-.6-6 1Z"), P("M12 6c0-2 1-3 3-4")]),
    Pin:         make([P("M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z"), C(12,10,3)]),
    Calendar:    make([R(3,4,18,18,2), P("M16 2v4M8 2v4M3 10h18")]),
    Download:    make([P("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"), P("M7 10l5 5 5-5"), P("M12 15V3")]),
    Hash:        make([P("M4 9h16"), P("M4 15h16"), P("M10 3 8 21"), P("M16 3l-2 18")]),
    Compare:     make([P("M21 7H8"), P("M12 3 8 7l4 4"), P("M3 17h13"), P("M12 21l4-4-4-4")]),
    ExtLink:     make([P("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"), P("M15 3h6v6"), P("m10 14 11-11")]),
    X:           make([P("M18 6 6 18"), P("m6 6 12 12")]),
    Logout:      make([P("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), P("m16 17 5-5-5-5"), P("M21 12H9")]),
    Menu:        make([P("M3 6h18"), P("M3 12h18"), P("M3 18h18")]),
    Home:        make([P("m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"), P("M9 22V12h6v10")]),
    Phone:       make([P("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z")]),
    Mail:        make([P("M22 6 12 13 2 6"), R(2,5,20,14,2)]),
  };

export { Icons };
  export function resolveHomeIcon(name) { return Icons[name] || Icons.Sparkle; }
