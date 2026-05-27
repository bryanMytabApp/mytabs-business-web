import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import moment from "moment";
import QRCode from "react-qr-code";
import { createEvent, updateEvent, deleteEvent, getPresignedUrlForEvent, getEventsByUserId } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getCustomerSubscription, getSystemSubscriptions } from "../../services/paymentService";
import { getMyOrganizations, getOrganizationBusinesses } from "../../services/organizationService";
import axios from "axios";

// ─── STYLES ───────────────────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
:root{
--or:#F5A623;--ord:#E09415;--te:#5BB8C1;--ted:#3D9DA6;
--tx:#2d3748;--mu:#8a9ab0;--li:#c4cdd6;
--ca:rgba(255,255,255,.90);--ib:rgba(255,255,255,.95);--ibr:#dde4ed;
--sh:0 4px 28px rgba(0,0,0,.08);--ss:0 2px 12px rgba(0,0,0,.05);
--tr:.2s cubic-bezier(.4,0,.2,1);
}
.ecn-wrap{min-height:100vh;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:24px;font-family:'Nunito',sans-serif;color:var(--tx);overflow-x:hidden}
.ecn-header{max-width:1200px;margin:0 auto 20px;padding:0;width:100%}
.ecn-layout{display:flex;gap:28px;max-width:1200px;margin:0 auto;align-items:flex-start}
.ecn-sidebar{width:220px;flex-shrink:0;position:sticky;top:24px;display:flex;flex-direction:column;align-items:center;gap:16px}
.ecn-side-img-row{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%}
.ecn-side-img{width:200px;height:200px;border-radius:16px;background:#FFFFFF;border:none;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.ecn-side-img img{width:100%;height:100%;object-fit:cover}
.ecn-side-img-empty{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--mu);font-size:12px;font-weight:600}
.ecn-side-qr{width:200px;background:#FFFFFF;border-radius:16px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;border:none;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.ecn-side-qr-img{width:140px;height:140px;background:#f8f8f8;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.ecn-side-qr-img svg{width:100%;height:100%}
.ecn-side-qr-placeholder{width:140px;height:140px;background:repeating-conic-gradient(#333 0% 25%,#fff 0% 50%) 50%/14px 14px;border-radius:8px;opacity:.15}
.ecn-side-code{font-size:10.5px;font-weight:700;color:var(--mu);letter-spacing:.5px;text-align:center;word-break:break-all}
.ecn-side-print{padding:7px 18px;border-radius:20px;background:transparent;border:2px solid #00AAD6;color:#00AAD6;font-size:12px;font-weight:600;font-family:'Outfit','Nunito',sans-serif;cursor:pointer;transition:all var(--tr)}
.ecn-side-print:hover{background:#00AAD6;color:#fff}
.ecn-side-name{font-size:13px;font-weight:800;color:var(--tx);text-align:center;max-width:180px;word-wrap:break-word}
.ecn-side-submit{padding:8px 24px;border-radius:20px;background:#F09925;border:2px solid transparent;color:#fff;font-size:12px;font-weight:600;font-family:'Outfit','Nunito',sans-serif;cursor:pointer;box-shadow:none;transition:all var(--tr)}
.ecn-side-submit:hover{background:#fff;color:#00AAD6;border-color:#00AAD6}
.ecn-page{flex:1;min-width:0;padding:0 0 80px;animation:ecnFadeUp .25s ease both;font-family:'Nunito',sans-serif;color:var(--tx)}
.ecn-page-w{max-width:none}
.ecn-steps{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:14px 18px;margin-bottom:24px;width:100%}
.ecn-step-btn{padding:8px 18px;border:none;border-radius:9px;font-size:13px;font-weight:500;color:#5a738a;cursor:default;transition:all 0.22s;font-family:'Nunito',sans-serif;background:none;white-space:nowrap}
.ecn-bb-full{display:inline}.ecn-bb-short{display:none}
@media(max-width:540px){.ecn-bb-full{display:none}.ecn-bb-short{display:inline}}
.ecn-step-btn.cur{background:#0077cc;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,119,204,0.25)}
.ecn-step-btn.done{color:#1ab76b;font-weight:600}
.ecn-tkt-grid{display:grid;grid-template-columns:200px 1fr 280px;gap:16px;align-items:start}
.ecn-pg-h{font-size:22px;font-weight:700;color:#F09925;margin-bottom:5px;font-family:'Outfit','Nunito',sans-serif}
.ecn-pg-s{font-size:13px;color:#6B7280;margin-bottom:24px;line-height:1.5}
.ecn-card{background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:16px}
.ecn-cs{font-size:13px;font-weight:700;color:#111827;letter-spacing:0;text-transform:none;margin-bottom:15px;display:flex;align-items:center;gap:7px}
.ecn-atg{display:flex;gap:12px;flex-wrap:wrap}
.ecn-atc{flex:1;min-width:120px;max-width:168px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:20px 14px 16px;cursor:pointer;transition:all var(--tr);display:flex;flex-direction:column;align-items:center;gap:9px;position:relative}
.ecn-atc:hover:not(.ecn-atd){box-shadow:0 2px 8px rgba(0,0,0,.08);transform:translateY(-2px);background:#fff}
.ecn-atc.ats{border-color:#00AAD6;background:#F0FDFF;box-shadow:0 0 0 2px rgba(0,170,214,.12)}
.ecn-atc.atd{opacity:.40;cursor:not-allowed}
.ecn-atr{position:absolute;top:10px;right:12px;width:18px;height:18px;border-radius:50%;border:2px solid #D1D5DB;display:flex;align-items:center;justify-content:center;transition:border-color var(--tr)}
.ecn-atc.ats .ecn-atr{border-color:#00AAD6}
.ecn-atd2{width:8px;height:8px;border-radius:50%;background:#00AAD6;display:none}
.ecn-atc.ats .ecn-atd2{display:block}
.ecn-at-l{font-size:13.5px;font-weight:800;color:var(--tx);text-align:center}
.ecn-atc.ats .ecn-at-l{color:var(--ted)}
.ecn-at-s{font-size:10.5px;color:var(--mu);text-align:center}
.ecn-fg{margin-bottom:16px}
.ecn-fg:last-child{margin-bottom:0}
.ecn-fl{display:block;font-size:13px;font-weight:600;color:#111827;margin-bottom:7px}
.ecn-fh{font-size:11.5px;color:var(--mu);margin-top:-3px;margin-bottom:7px}
.ecn-fi,.ecn-fs,.ecn-fta{width:100%;padding:10px 14px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;font-weight:500;color:var(--tx);font-family:'Outfit','Nunito',sans-serif;transition:all var(--tr);outline:none;appearance:none;box-sizing:border-box}
.ecn-fi:focus,.ecn-fs:focus,.ecn-fta:focus{border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,.1);background:#fff}
.ecn-fi::placeholder{color:#9CA3AF}
.ecn-fta{resize:none;min-height:60px;line-height:1.6}
.ecn-fr{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ecn-fr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.ecn-sw{position:relative}
.ecn-sw::after{content:'';position:absolute;right:13px;top:50%;transform:translateY(-50%);border:5px solid transparent;border-top:6px solid #6B7280;margin-top:3px;pointer-events:none}
.ecn-rrow{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;cursor:pointer;transition:all var(--tr);margin-bottom:9px}
.ecn-rrow:last-child{margin-bottom:0}
.ecn-rrow:hover{background:#FAFBFC;border-color:#D1D5DB}
.ecn-rrow.rsel{border-color:#00AAD6;background:#F0FDFF}
.ecn-rci{width:19px;height:19px;border-radius:50%;border:2px solid #D1D5DB;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:border-color var(--tr)}
.ecn-rrow.rsel .ecn-rci{border-color:#00AAD6}
.ecn-rin{width:9px;height:9px;border-radius:50%;background:#00AAD6;display:none}
.ecn-rrow.rsel .ecn-rin{display:block}
.ecn-rl2{font-size:13.5px;font-weight:700;color:var(--tx)}
.ecn-rs2{font-size:11.5px;color:var(--mu);margin-top:2px}

.ecn-upl{border:2px dashed rgba(0,0,0,.13);border-radius:13px;background:rgba(255,255,255,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:50px 22px;cursor:pointer;transition:all var(--tr);position:relative;text-align:center}
.ecn-upl:hover{border-color:var(--or);background:rgba(245,166,35,.04)}
.ecn-upl.hi{padding:16px;border-style:solid;border-color:var(--te);background:rgba(91,184,193,.05)}
.ecn-upl img{max-width:100%;max-height:170px;border-radius:9px;object-fit:contain}
.ecn-upl-del{position:absolute;top:9px;right:9px;width:25px;height:25px;border-radius:50%;background:#ef4444;color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer}
.ecn-upl-tx{font-size:13.5px;color:var(--mu)}
.ecn-upl-lk{color:var(--or);font-weight:700}
.ecn-upl-hi{font-size:11px;color:var(--li)}
.ecn-tc{display:flex;flex-direction:column;gap:9px}
.ecn-trow{display:flex;align-items:center;gap:9px;padding:11px 13px;background:#fff;border:1.5px solid var(--ibr);border-radius:11px;cursor:pointer;transition:all var(--tr)}
.ecn-trow:hover{border-color:rgba(91,184,193,.4)}
.ecn-trow.tsel{border-color:var(--te);box-shadow:0 0 0 2px rgba(91,184,193,.12)}
.ecn-tn{font-size:13px;font-weight:700;color:var(--tx);flex:1}
.ecn-tm{font-size:11px;color:var(--mu)}
.ecn-tdel{width:24px;height:24px;border-radius:6px;background:rgba(239,68,68,.08);border:none;color:#ef4444;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--tr)}
.ecn-tdel:hover{background:rgba(239,68,68,.18)}
.ecn-tadd{display:flex;align-items:center;gap:7px;padding:12px 14px;background:rgba(255,255,255,.55);border:1.5px dashed rgba(0,0,0,.11);border-radius:11px;cursor:pointer;font-size:13px;font-weight:700;color:var(--ted);font-family:'Nunito',sans-serif;transition:all var(--tr);border-width:1.5px}
.ecn-tadd:hover{background:rgba(91,184,193,.08);border-color:var(--te)}
.ecn-tform{background:rgba(255,255,255,.65);border-radius:13px;padding:18px;border:1.5px solid rgba(0,0,0,.07)}
.ecn-fee{display:flex;justify-content:space-between;font-size:12.5px;color:var(--mu);padding:3px 0}
.ecn-fee.fb{font-size:13.5px;font-weight:800;color:var(--tx)}
.ecn-fee.fg2{color:#16a34a;font-weight:800;font-size:13.5px}
.ecn-fdv{height:1px;background:var(--ibr);margin:8px 0}
.ecn-pc{background:#fff;border-radius:13px;padding:17px 19px;border:1.5px solid rgba(0,0,0,.06);box-shadow:var(--ss);margin-top:13px}
.ecn-pl{font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.ecn-pv{font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px}
.ecn-tbtn{width:100%;padding:12px;background:var(--te);color:#fff;border:none;border-radius:10px;font-size:13.5px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer;margin-top:13px;transition:background var(--tr)}
.ecn-tbtn:hover{background:var(--ted)}
.ecn-kc{background:rgba(255,255,255,.62);border:1.5px solid var(--ibr);border-radius:13px;padding:19px 21px;margin-bottom:12px;position:relative;transition:box-shadow var(--tr)}
.ecn-kc:hover{box-shadow:var(--ss)}
.ecn-kn{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:7px;background:rgba(245,166,35,.11);color:var(--or);font-size:11px;font-weight:900}
.ecn-kd{position:absolute;top:12px;right:12px;width:25px;height:25px;border-radius:6px;background:rgba(239,68,68,.08);border:none;color:#ef4444;font-size:11.5px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--tr)}
.ecn-kd:hover{background:rgba(239,68,68,.18)}
.ecn-ri{flex:1;height:5px;border-radius:99px;appearance:none;cursor:pointer;outline:none;background:linear-gradient(to right,var(--or) 0%,var(--or) var(--p,70%),var(--ibr) var(--p,70%))}
.ecn-ri::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:var(--or);border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.18);cursor:pointer}
.ecn-kadd{width:100%;padding:12px;background:rgba(255,255,255,.65);border:2px dashed rgba(0,0,0,.11);border-radius:12px;font-size:13.5px;font-weight:700;color:var(--ted);font-family:'Nunito',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all var(--tr)}
.ecn-kadd:hover{background:rgba(91,184,193,.08);border-color:var(--te)}
.ecn-pp{padding:7px 14px;border-radius:99px;background:rgba(255,255,255,.72);border:1.5px solid var(--ibr);font-size:12px;font-weight:700;color:var(--ted);font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr)}
.ecn-pp:hover{background:#fff;border-color:var(--te);transform:translateY(-1px)}

.ecn-chr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(255,255,255,.62);border:1.5px solid var(--ibr);border-radius:11px;margin-bottom:8px;transition:border-color var(--tr)}
.ecn-chr.on{border-color:rgba(91,184,193,.38);background:rgba(91,184,193,.04)}
.ecn-chl{display:flex;align-items:center;gap:11px}
.ecn-chn{font-size:13.5px;font-weight:700;color:var(--tx)}
.ecn-chd{font-size:11.5px;color:var(--mu);margin-top:2px}
.ecn-tog{width:42px;height:23px;border-radius:99px;border:none;position:relative;cursor:pointer;padding:0;flex-shrink:0;transition:background var(--tr)}
.ecn-tog.on{background:var(--te)}
.ecn-tog.off{background:var(--ibr)}
.ecn-tok{position:absolute;top:2.5px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.16);transition:left var(--tr)}
.ecn-tog.on .ecn-tok{left:21px}
.ecn-tog.off .ecn-tok{left:2.5px}
.ecn-cpg{display:flex;flex-wrap:wrap;gap:8px}
.ecn-cpb{padding:7px 15px;border-radius:99px;font-size:12.5px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr);border:1.5px solid}
.ecn-cpb.on{background:rgba(245,166,35,.11);color:var(--or);border-color:var(--or)}
.ecn-cpb.off{background:rgba(255,255,255,.65);color:var(--mu);border-color:var(--ibr)}
.ecn-cpb:hover{transform:translateY(-1px)}
.ecn-st{display:flex;gap:4px;background:rgba(0,0,0,.055);padding:4px;border-radius:11px;margin-bottom:18px;width:fit-content}
.ecn-stb{padding:7px 20px;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .18s}
.ecn-stb.on{background:#fff;color:var(--or);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.ecn-stb.off{background:transparent;color:var(--mu)}
.ecn-rv-s{background:rgba(255,255,255,.65);border-radius:13px;padding:17px 19px;margin-bottom:11px;border:1.5px solid rgba(0,0,0,.055)}
.ecn-rv-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px}
.ecn-rv-t{font-size:13px;font-weight:800;color:var(--tx);display:flex;align-items:center;gap:7px}
.ecn-rv-e{font-size:12px;color:var(--ted);font-weight:700;cursor:pointer;border:none;background:none;font-family:'Nunito',sans-serif}
.ecn-rv-r{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(0,0,0,.04);font-size:13px}
.ecn-rv-r:last-child{border-bottom:none}
.ecn-rv-l{color:var(--mu);font-weight:600}
.ecn-rv-v{color:var(--tx);font-weight:700;text-align:right;max-width:64%}
.ecn-kpill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:rgba(245,166,35,.10);color:var(--or);font-size:11.5px;font-weight:700;margin:3px}
.ecn-ok-box{background:rgba(91,184,193,.08);border:1.5px solid rgba(91,184,193,.22);border-radius:13px;padding:13px 17px;margin-bottom:20px}
.ecn-err{border-color:#ef4444 !important;box-shadow:0 0 0 2px rgba(239,68,68,.12) !important}
.ecn-err-msg{font-size:11.5px;color:#ef4444;font-weight:600;margin-top:4px}
.ecn-err-banner{background:rgba(239,68,68,.06);border:1.5px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#ef4444;font-weight:600}
.ecn-bn{background:var(--or);color:#fff;border:none;border-radius:12px;padding:12px 34px;font-size:14.5px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(245,166,35,.33);transition:all var(--tr)}
.ecn-bn:hover{background:var(--ord);transform:translateY(-1px);box-shadow:0 6px 20px rgba(245,166,35,.40)}
.ecn-bn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.ecn-bb{background:rgba(255,255,255,.80);color:var(--tx);border:1.5px solid rgba(0,0,0,.09);border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--tr)}
.ecn-bb:hover{background:#fff}
.ecn-bsk{background:transparent;color:var(--mu);border:1.5px solid var(--ibr);border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr)}
.ecn-bsk:hover{background:rgba(255,255,255,.7);color:var(--tx)}
.ecn-bla{background:linear-gradient(130deg,var(--or) 0%,#f97316 100%);color:#fff;border:none;border-radius:12px;padding:14px 46px;font-size:15.5px;font-weight:900;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:10px;box-shadow:0 6px 22px rgba(245,166,35,.38);transition:all var(--tr)}
.ecn-bla:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(245,166,35,.46)}
.ecn-foot{position:sticky;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-top:1px solid #E5E7EB;padding:13px 24px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 -2px 12px rgba(0,0,0,.04);border-radius:0 0 16px 16px;margin-top:20px}
.ecn-fr2{display:flex;gap:9px;align-items:center}
.ecn-bdg{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700}
.ecn-bt2{background:rgba(91,184,193,.13);color:var(--ted)}
.ecn-bo2{background:rgba(245,166,35,.12);color:var(--or)}
.ecn-ek{text-align:center;padding:28px 18px;border:2px dashed rgba(0,0,0,.10);border-radius:13px;background:rgba(255,255,255,.38)}
.ecn-succ{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:36px;max-width:600px;margin:0 auto}
.ecn-si{font-size:64px;margin-bottom:16px;animation:ecnPop .5s cubic-bezier(.175,.885,.32,1.275) .15s both}
.ecn-sh{font-size:24px;font-weight:900;color:var(--tx);margin-bottom:9px}
.ecn-ss2{font-size:13.5px;color:var(--mu);max-width:380px;margin-bottom:28px;line-height:1.7}
.ecn-sdcard{background:#fff;border:1.5px solid var(--ibr);border-radius:14px;margin-bottom:12px;overflow:hidden;transition:box-shadow var(--tr)}
.ecn-sdcard:hover{box-shadow:var(--ss)}
.ecn-sdhd{display:flex;align-items:center;gap:11px;padding:14px 16px;cursor:pointer;user-select:none}
.ecn-sdhd:hover{background:rgba(0,0,0,.02)}
.ecn-sdnum{width:28px;height:28px;border-radius:8px;background:rgba(91,184,193,.12);color:var(--ted);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0}
.ecn-sdtitle{font-size:13.5px;font-weight:700;color:var(--tx)}
.ecn-sdsub{font-size:11.5px;color:var(--mu);margin-top:2px}
.ecn-sdbd{padding:0 16px 16px;border-top:1px solid var(--ibr)}
.ecn-sdc{transition:transform var(--tr);color:var(--mu);flex-shrink:0}
.ecn-sdc.op{transform:rotate(180deg)}
.ecn-sdadd{width:100%;padding:13px;background:rgba(255,255,255,.65);border:2px dashed rgba(0,0,0,.11);border-radius:13px;font-size:13.5px;font-weight:700;color:var(--ted);font-family:'Nunito',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all var(--tr);margin-top:4px}
.ecn-sdadd:hover{background:rgba(91,184,193,.08);border-color:var(--te)}
.ecn-sddel{width:26px;height:26px;border-radius:7px;background:rgba(239,68,68,.08);border:none;color:#ef4444;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background var(--tr)}
.ecn-sddel:hover{background:rgba(239,68,68,.18)}
.ecn-schip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700}
.ecn-sch-sc{background:rgba(91,184,193,.13);color:var(--ted)}
.ecn-sch-so{background:rgba(245,166,35,.12);color:var(--or)}
.ecn-sch-dn{background:rgba(0,0,0,.07);color:var(--mu)}
.ecn-sbar{display:flex;gap:20px;flex-wrap:wrap;padding:13px 17px;background:rgba(91,184,193,.07);border-radius:12px;margin-bottom:15px;border:1.5px solid rgba(91,184,193,.18)}
.ecn-sbi{text-align:center}
.ecn-sbv{font-size:20px;font-weight:900;color:var(--ted);line-height:1}
.ecn-sbl{font-size:10.5px;color:var(--mu);font-weight:700;margin-top:3px}
.ecn-vis{display:flex;gap:12px;flex-wrap:wrap}
.ecn-visc{flex:1;min-width:140px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;cursor:pointer;transition:all var(--tr);display:flex;align-items:flex-start;gap:10px}
.ecn-visc:hover{background:#FAFBFC;border-color:#D1D5DB}
.ecn-visc.vsel{border-color:#00AAD6;background:#F0FDFF;box-shadow:0 0 0 2px rgba(0,170,214,.12)}
.ecn-vrad{width:18px;height:18px;border-radius:50%;border:2px solid #D1D5DB;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:border-color var(--tr)}
.ecn-visc.vsel .ecn-vrad{border-color:#00AAD6}
.ecn-vdot{width:8px;height:8px;border-radius:50%;background:#00AAD6;display:none;margin:0}
.ecn-visc.vsel .ecn-vdot{display:block}
.ecn-vl{font-size:13.5px;font-weight:700;color:var(--tx)}
.ecn-vd{font-size:11.5px;color:var(--mu);margin-top:2px}
@keyframes ecnFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes ecnPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@media(max-width:860px){.ecn-page{padding:18px 14px 100px}.ecn-fr,.ecn-fr3{grid-template-columns:1fr}.ecn-foot{padding:12px 16px}.ecn-layout{flex-direction:column}.ecn-sidebar{width:100%;position:static;flex-direction:row;flex-wrap:nowrap;justify-content:stretch;align-items:stretch;gap:12px}.ecn-side-img-row,.ecn-side-qr{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:12px;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);gap:10px}.ecn-side-img{width:100%;height:auto;aspect-ratio:1/1;flex-shrink:0;box-shadow:none;border-radius:12px}.ecn-side-img img{width:100%;height:100%;object-fit:cover}.ecn-side-img-row .ecn-side-print,.ecn-side-qr .ecn-side-print{margin:0;white-space:nowrap;align-self:stretch;text-align:center}.ecn-side-qr-img{width:100%;max-width:160px;height:auto;aspect-ratio:1/1;flex-shrink:0}.ecn-side-code{text-align:center;font-size:11px;word-break:break-all}.ecn-steps{flex-wrap:nowrap;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:none;padding:10px 12px;justify-content:flex-start}.ecn-steps::-webkit-scrollbar{display:none}.ecn-step-btn{flex:0 0 auto;scroll-snap-align:center;padding:8px 14px}.ecn-vis{flex-direction:column}.ecn-tkt-grid{grid-template-columns:1fr;gap:16px}.ecn-header .ecn-steps{flex-direction:row;align-items:center}.ecn-wrap{padding:12px}.ecn-rv-r{flex-direction:column;gap:2px}.ecn-rv-v{max-width:100%;text-align:left;word-break:break-word}.ecn-card{padding:16px}.ecn-rv-s{padding:14px}.ecn-header{padding:0}.ecn-pg-h{font-size:18px}.ecn-fi,.ecn-fs,.ecn-fta{font-size:16px;padding:14px}.ecn-fl{font-size:14px;margin-bottom:10px}}.ecn-side-qr-placeholder{width:80px;height:80px}}
.ecn-del-btn{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--tr)}
.ecn-del-btn:hover{background:#dc2626}
.ecn-del-btn:disabled{opacity:.5;cursor:not-allowed}
.ecn-del-foot{background:transparent;color:#ef4444;border:1.5px solid #fecaca;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--tr)}
.ecn-del-foot:hover{background:#fef2f2;border-color:#ef4444}
.ecn-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;animation:ecnFadeIn .2s ease}
.ecn-modal{background:#fff;border-radius:16px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:ecnSlideUp .25s ease}
.ecn-modal-icon{width:56px;height:56px;border-radius:50%;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.ecn-modal-title{font-size:20px;font-weight:800;color:#111827;text-align:center;margin-bottom:8px}
.ecn-modal-msg{font-size:14px;color:#6B7280;text-align:center;margin-bottom:24px;line-height:1.6}
.ecn-modal-btns{display:flex;gap:12px;justify-content:center}
.ecn-modal-cancel{background:#f3f4f6;color:#374151;border:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr)}
.ecn-modal-cancel:hover{background:#e5e7eb}
.ecn-modal-confirm{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr)}
.ecn-modal-confirm:hover{background:#dc2626}
.ecn-modal-confirm:disabled{opacity:.5;cursor:not-allowed}
@keyframes ecnFadeIn{from{opacity:0}to{opacity:1}}
@keyframes ecnSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
function I({ n, s = 20, c = "currentColor", w = 1.65 }) {
  const p = {
    home: <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    film: <><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    up: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    tkt: <><path d="M2 9a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V3a1 1 0 011-1h18a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H21a1 1 0 011 1v6a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H21a1 1 0 011 1v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V9z"/></>,
    bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    chk: <><polyline points="20 6 9 17 4 12"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    pin: <><polygon points="3 11 22 2 13 21 11 13 3 11"/></>,
    clk: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    img: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    link: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
    ban: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>,
    chev: <><polyline points="6 9 12 15 18 9"/></>,
    chevL: <><polyline points="15 18 9 12 15 6"/></>,
    bar: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    warn: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);
const CATS = ["Athletics", "Student Life", "Academic", "Alumni", "Community", "Arts & Culture", "Greek Life", "Career", "Conference", "Other"];
const TKTS = ["General Admission", "VIP", "Early Bird", "Student", "Senior", "Group", "Custom"];
const KT = [{ v: "number", l: "Count" }, { v: "currency", l: "Currency ($)" }, { v: "percentage", l: "Percentage (%)" }];
const CHS = [
  { id: "dash", n: "Dashboard Alerts", d: "Real-time in-app", ic: "bell", on: true },
  { id: "eml", n: "Email", d: "Coordinator & team", ic: "info", on: true },
  { id: "sms", n: "SMS / Text", d: "Critical alerts only", ic: "pin", on: true },
  { id: "push", n: "Push Notifications", d: "Mobile app", ic: "bell", on: true },
  { id: "slk", n: "Slack", d: "Team channel", ic: "link", on: false },
];
const SE = [{ n: 1, l: "Setup" }, { n: 2, l: "Media" }, { n: 3, l: "Ticketing" }, { n: 4, l: "KPIs & Alerts" }, { n: 5, l: "Review" }];
const SS = [{ n: 1, l: "Setup" }, { n: 2, l: "Show Dates" }, { n: 3, l: "Media" }, { n: 4, l: "Ticketing" }, { n: 5, l: "KPIs & Alerts" }, { n: 6, l: "Review" }];

// ─── SIDE PANEL ───────────────────────────────────────────────────────────────
function SidePanel({ f, onImageUpload, businessCode }) {
  const fileRef = useRef();
  const [showLightbox, setShowLightbox] = useState(false);
  const hasImage = !!f.media;
  // Use real eventCode from database if available, otherwise generate a preview code
  // When businessCode is available, use its BIZ segment for the preview
  const bizSegment = (() => {
    if (businessCode) {
      const m = businessCode.match(/BIZ-([A-Z0-9]{4})/);
      if (m) return m[1];
      return businessCode.replace(/[^A-Z0-9]/g, '').slice(-4) || 'XXXX';
    }
    return 'XXXX';
  })();
  const eventCode = f.eventCode
    || (f.name ? `BIZ-${bizSegment}-EVT-${f.name.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'XXXX'}` : `BIZ-${bizSegment}-EVT-XXXX`);
  const qrValue = `https://keeptabs.app/e/${eventCode}`;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file && onImageUpload) onImageUpload(file);
  };

  const handlePrintQR = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const svg = document.getElementById("ecn-qr-code");
      if (!svg) { toast.error("QR code not ready"); return; }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");

      const img = new Image();
      const qrDataUrl = await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 1024, 1024);
          ctx.drawImage(img, 0, 0, 1024, 1024);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4, 6] });
      const eventName = f.name || 'Event';

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      const nameWidth = pdf.getTextWidth(eventName);
      pdf.text(eventName, (4 - nameWidth) / 2, 0.7);

      const qrSize = 2.5;
      const qrX = (4 - qrSize) / 2;
      const qrY = 1.2;
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const codeWidth = pdf.getTextWidth(eventCode);
      pdf.text(eventCode, (4 - codeWidth) / 2, qrY + qrSize + 0.4);

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const urlWidth = pdf.getTextWidth(qrValue);
      pdf.text(qrValue, (4 - urlWidth) / 2, 5.5);

      pdf.save(`${eventName.replace(/[^a-zA-Z0-9]/g, '_')}-QR.pdf`);
    } catch (err) {
      console.error('Failed to generate QR PDF:', err);
      toast.error('Failed to generate QR PDF');
    }
  };

  return (
    <div className="ecn-sidebar">
      {/* Event Image Card — image + Submit button. Wrapped so on mobile
          they line up side-by-side like the QR card below. */}
      <div className="ecn-side-img-row">
        <div className="ecn-side-img" style={hasImage ? { cursor: 'pointer' } : {}} onClick={() => hasImage && setShowLightbox(true)}>
          {hasImage
            ? <img src={f.media} alt="Event" />
            : <div className="ecn-side-img-empty"><I n="img" s={36} c="var(--li)" w={1.2} /><span>Event Image</span></div>
          }
        </div>
        <button className="ecn-side-print" onClick={() => fileRef.current?.click()}>
          Submit &uarr;
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

      {/* Image Lightbox */}
      {showLightbox && hasImage && ReactDOM.createPortal(
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 99999, cursor: 'pointer',
            animation: 'ecnFadeIn .2s ease',
          }}
        >
          <img
            src={f.media}
            alt="Event preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)', cursor: 'default',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={() => setShowLightbox(false)}
            style={{
              position: 'absolute', top: 20, right: 20, width: 36, height: 36,
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>
        </div>,
        document.body
      )}

      {/* QR Code Card */}
      <div className="ecn-side-qr">
        <div className="ecn-side-qr-img">
          <QRCode
            id="ecn-qr-code"
            size={140}
            style={{ height: "auto", maxWidth: "100%", width: "140px" }}
            value={qrValue}
            viewBox="0 0 256 256"
            level="H"
          />
          {/* Tabs logo overlay */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 36, height: 36, backgroundColor: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>
            <img src="/tabs-logo.svg" alt="Tabs" style={{ width: 28, height: 28 }} onError={e => { e.target.style.display = "none"; e.target.parentElement.innerHTML = '<span style="font-size:14px;font-weight:900;color:#f97316">T</span>'; }} />
          </div>
        </div>
        <div className="ecn-side-code">{eventCode}</div>
        <button className="ecn-side-print" onClick={handlePrintQR}>Print QR Code (PDF)</button>
      </div>
    </div>
  );
}

// ─── STEP 1: SETUP ────────────────────────────────────────────────────────────
function P1({ f, u, next, steps, editMode, eventId, onDelete, previewEventCode, allBusinesses, selectedBusinessId, onBusinessChange }) {
  const isS = f.adType === "shows";
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const validate = () => {
    const errs = {};
    if (!f.adType) errs.adType = "Select an ad type";
    if (!f.name) errs.name = "Event name is required";
    if (!isS) {
      if (!f.date) errs.date = "Event date is required";
      if (!f.t1) errs.t1 = "Start time is required";
      if (!f.t2) errs.t2 = "End time is required";
    }
    return errs;
  };

  const handleNext = () => {
    setAttempted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      next();
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  // Clear individual errors as user types
  const handleChange = (key, val) => {
    u(key, val);
    if (attempted && errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  // Initialize Google Places Autocomplete when "New address" is selected
  useEffect(() => {
    if (f.loc !== "new" || !addressInputRef.current) return;
    let cancelled = false;

    import('../../utils/googleMaps').then(({ loadGoogleMaps }) => loadGoogleMaps()).then(() => {
      if (cancelled || !addressInputRef.current) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        { types: ['address'], componentRestrictions: { country: 'us' } }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.address_components) return;

        let streetNumber = '';
        let route = '';
        let city = '';
        let state = '';
        let zipCode = '';

        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) streetNumber = component.long_name;
          if (types.includes('route')) route = component.long_name;
          if (types.includes('locality')) city = component.long_name;
          else if (!city && types.includes('sublocality_level_1')) city = component.long_name;
          else if (!city && types.includes('sublocality')) city = component.long_name;
          else if (!city && types.includes('postal_town')) city = component.long_name;
          else if (!city && types.includes('administrative_area_level_3')) city = component.long_name;
          if (types.includes('administrative_area_level_1')) state = component.long_name;
          if (types.includes('postal_code')) zipCode = component.long_name;
        });

        const fullAddress = `${streetNumber} ${route}`.trim();
        u("addr", fullAddress);
        u("city", city);
        u("zip", `${state} ${zipCode}`.trim());
      });
    });

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.loc]);

  const ADS = [
    { id: "event", i: "cal", l: "Event", sb: null, dis: false },
    { id: "shows", i: "film", l: "Shows", sb: "Multiple dates", dis: false },
    { id: "menu", i: "plus", l: "Menu", sb: "Coming Soon", dis: true },
    { id: "sales", i: "tag", l: "Sales/Special", sb: "Coming Soon", dis: true },
  ];
  return (
    <div className="ecn-page">

      {/* Ad Type — collapse to pill once selected */}
      {f.adType ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button className="ecn-bb" onClick={() => handleChange("adType", "")} style={{ background: "rgba(91,184,193,.08)", borderColor: "var(--te)", color: "var(--ted)" }}>
            <I n={ADS.find(a => a.id === f.adType)?.i || "tag"} s={14} c="var(--ted)" w={1.7} />
            {ADS.find(a => a.id === f.adType)?.l || "Ad Type"}
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--mu)" }}>&times; change</span>
          </button>
        </div>
      ) : (
        <div className="ecn-card">
          <div className="ecn-cs"><I n="tag" s={13} c="var(--mu)" w={2} /> Ad Type</div>
          <div className="ecn-atg">
            {ADS.map(t => (
              <div key={t.id} className={`ecn-atc${f.adType === t.id ? " ats" : ""}${t.dis ? " atd" : ""}`} onClick={() => !t.dis && handleChange("adType", t.id)}>
                <div className="ecn-atr"><div className="ecn-atd2" /></div>
                <I n={t.i} s={28} c={f.adType === t.id ? "var(--ted)" : "var(--mu)"} w={1.4} />
                <div className="ecn-at-l">{t.l}</div>
                {t.sb && <div className="ecn-at-s">{t.sb}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {f.adType && <>
      <div className="ecn-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Event Information</div>
            <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>Update your event details</div>
          </div>
          {editMode && eventId && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", backgroundColor: "#F5F3FF", borderRadius: 8, border: "1px solid #E9E5FF" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Event Code:</span>
              <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#4F46E5", letterSpacing: 1 }}>{f.eventCode || previewEventCode || "Code updates on save"}</span>
              <button
                onClick={() => handleCopyCode(f.eventCode || previewEventCode || "")}
                title={codeCopied ? "Copied!" : "Copy"}
                style={{
                  background: "none",
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: codeCopied ? "#059669" : "#6B7280"
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="ecn-fg">
          <label className="ecn-fl">{isS ? "Show name" : "Event name"} *</label>
          <input className={`ecn-fi${errors.name ? " ecn-err" : ""}`} placeholder="Type title" maxLength={50} value={f.name} onChange={e => handleChange("name", e.target.value)} />
          {errors.name && <div className="ecn-err-msg">{errors.name}</div>}
          <div style={{ fontSize: 11.5, color: "var(--mu)", marginTop: 4 }}>{(f.name || "").length}/50 characters</div>
        </div>
        {allBusinesses && allBusinesses.length > 1 && (
          <div className="ecn-fg">
            <label className="ecn-fl">Business *</label>
            <div className="ecn-sw">
              <select
                className="ecn-fs"
                value={selectedBusinessId || ''}
                onChange={e => onBusinessChange && onBusinessChange(e.target.value)}
              >
                {allBusinesses.map(biz => (
                  <option key={biz.linkedBusinessId} value={biz.linkedBusinessId}>
                    {biz.name}{biz.isPayer ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mu)", marginTop: 4 }}>Which business this event belongs to</div>
          </div>
        )}
        <div className="ecn-fr">
          <div className="ecn-fg" style={{ marginBottom: 0 }}>
            <label className="ecn-fl">Category</label>
            <div className="ecn-sw"><select className="ecn-fs" value={f.cat} onChange={e => u("cat", e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="ecn-fg" style={{ marginBottom: 0 }}>
            <label className="ecn-fl">{isS ? "Typical capacity" : "Expected capacity"}</label>
            <input className="ecn-fi" type="number" placeholder="e.g. 500" value={f.cap} onChange={e => u("cap", e.target.value)} />
          </div>
        </div>
      </div>

      {!isS && (
        <div className="ecn-card">
          <div className="ecn-cs"><I n="clk" s={13} c="var(--mu)" w={2} /> Date &amp; Time</div>
          <div className="ecn-fg">
            <label className="ecn-fl">Event date *</label>
            <div className="ecn-fh">e.g. Thu 21 March, 2026</div>
            <input className={`ecn-fi${errors.date ? " ecn-err" : ""}`} type="date" value={f.date} onChange={e => handleChange("date", e.target.value)} />
            {errors.date && <div className="ecn-err-msg">{errors.date}</div>}
          </div>
          <div className="ecn-fr" style={{ marginBottom: 0 }}>
            <div className="ecn-fg" style={{ marginBottom: 0 }}>
              <label className="ecn-fl">Start time *</label>
              <input className={`ecn-fi${errors.t1 ? " ecn-err" : ""}`} type="time" value={f.t1} onChange={e => handleChange("t1", e.target.value)} />
              {errors.t1 && <div className="ecn-err-msg">{errors.t1}</div>}
            </div>
            <div className="ecn-fg" style={{ marginBottom: 0 }}>
              <label className="ecn-fl">End time *</label>
              <input className={`ecn-fi${errors.t2 ? " ecn-err" : ""}`} type="time" value={f.t2} onChange={e => handleChange("t2", e.target.value)} />
              {errors.t2 && <div className="ecn-err-msg">{errors.t2}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="ecn-card">
        <div className="ecn-cs"><I n="pin" s={13} c="var(--mu)" w={2} /> Details &amp; Location</div>
        <div className="ecn-fg">
          <label className="ecn-fl">Description</label>
          <textarea className="ecn-fta" placeholder="Tell attendees what this is about..." maxLength={300} value={f.desc} onChange={e => u("desc", e.target.value)} />
          <div style={{ fontSize: 11.5, color: "var(--mu)", marginTop: 4 }}>{(f.desc || "").length}/300 characters</div>
        </div>
        <div className="ecn-fg">
          <label className="ecn-fl">Venue name</label>
          <input className="ecn-fi" placeholder="e.g. Panther Stadium" value={f.venue} onChange={e => u("venue", e.target.value.slice(0, 50))} maxLength={50} />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>{(f.venue || '').length}/50</div>
        </div>
        <div className="ecn-fg" style={{ marginBottom: 0 }}>
          <label className="ecn-fl">Location</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ id: "biz", l: "Business address", s: "Your registered address" }, { id: "new", l: "New address", s: "Enter a specific location" }].map(o => (
            <div key={o.id} className={`ecn-rrow${f.loc === o.id ? " rsel" : ""}`} style={{ marginBottom: 0 }} onClick={() => u("loc", o.id)}>
              <div className="ecn-rci"><div className="ecn-rin" /></div>
              <div><div className="ecn-rl2">{o.l}</div><div className="ecn-rs2">{o.s}</div></div>
            </div>
          ))}
          </div>
        </div>
        {f.loc === "new" && (
          <div style={{ marginTop: 14 }}>
            <div className="ecn-fg"><label className="ecn-fl">Street address</label><input ref={addressInputRef} className="ecn-fi" placeholder="Start typing address..." value={f.addr} onChange={e => u("addr", e.target.value)} /></div>
            <div className="ecn-fr" style={{ marginBottom: 0 }}>
              <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">City</label><input className="ecn-fi" placeholder="Houston" value={f.city} onChange={e => u("city", e.target.value)} /></div>
              <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">State &amp; ZIP</label><input className="ecn-fi" placeholder="Texas 77002" value={f.zip} onChange={e => u("zip", e.target.value)} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="ecn-card">
        <div className="ecn-cs"><I n="info" s={13} c="var(--mu)" w={2} /> Event Visibility</div>
        <div className="ecn-vis">
          {[{ id: "public", l: "Public", d: "Visible to all Tabs users" }, { id: "business", l: "Business", d: "Visible to business members only" }, { id: "private", l: "Private", d: "Visible only to invited attendees" }].map(v => (
            <div key={v.id} className={`ecn-visc${f.visibility === v.id ? " vsel" : ""}`} onClick={() => u("visibility", v.id)}>
              <div className="ecn-vrad"><div className="ecn-vdot" /></div>
              <div><div className="ecn-vl">{v.l}</div><div className="ecn-vd">{v.d}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="ecn-foot">
        {editMode ? (
          <button className="ecn-del-foot" onClick={onDelete}><I n="trash" s={14} c="#ef4444" w={2} /> Delete</button>
        ) : <div />}
        <button className="ecn-bn" onClick={handleNext}>Next →</button>
      </div>
      </>}
    </div>
  );
}

// ─── SHOW DATES STEP ──────────────────────────────────────────────────────────
const mkDate = () => ({ id: uid(), label: "", date: "", t1: "", t2: "", venue: "", cap: "", notes: "", status: "scheduled", open: true });

function P_ShowDates({ f, u, next, back, maxAdSpaces = 3, existingEventsCount = 0 }) {
  const [dates, setD] = useState(f.showDates?.length ? f.showDates : [mkDate()]);
  const remainingSpaces = Math.max(0, maxAdSpaces - existingEventsCount);
  const sy = d => { setD(d); u("showDates", d); };
  const add = () => sy([...dates, mkDate()]);
  const del = i => dates.length > 1 && sy(dates.filter((_, j) => j !== i));
  const upd = (i, k, v) => sy(dates.map((d, j) => j === i ? { ...d, [k]: v } : d));
  const tog = i => sy(dates.map((d, j) => j === i ? { ...d, open: !d.open } : d));
  const fd = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "No date set";
  const ft = t => { if (!t) return ""; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
  const SC = [{ v: "scheduled", l: "Scheduled" }, { v: "soldout", l: "Sold Out" }, { v: "completed", l: "Completed" }, { v: "cancelled", l: "Cancelled" }];
  const canNext = dates.some(d => d.date && d.t1 && d.t2);

  const handleNext = () => {
    if (!canNext) {
      toast.error("At least one show date must have a date, start time, and end time");
      return;
    }
    if (dates.length > remainingSpaces && remainingSpaces > 0) {
      toast.error(`Your plan allows ${maxAdSpaces} total ad spaces. You have ${existingEventsCount} existing events, so you can add up to ${remainingSpaces} show dates.`);
      return;
    }
    next();
  };

  return (
    <div className="ecn-page">
      <button className="ecn-bb" style={{ marginBottom: 20 }} onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>

      {dates.length > 0 && (
        <div className="ecn-sbar">
          {[{ v: dates.length, l: "Total Dates" }, { v: dates.filter(d => d.status === "scheduled").length, l: "Scheduled" }, { v: `${remainingSpaces - dates.length >= 0 ? remainingSpaces - dates.length : 0}`, l: "Remaining Spaces" }, { v: maxAdSpaces, l: "Plan Capacity" }].map(s => (
            <div key={s.l} className="ecn-sbi"><div className="ecn-sbv">{s.v}</div><div className="ecn-sbl">{s.l}</div></div>
          ))}
        </div>
      )}

      {dates.map((d, i) => (
        <div key={d.id} className="ecn-sdcard">
          <div className="ecn-sdhd" onClick={() => tog(i)}>
            <div className="ecn-sdnum">{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ecn-sdtitle">{d.label || (d.date ? fd(d.date) : `Date ${i + 1}`)}</div>
              <div className="ecn-sdsub">{[d.date ? fd(d.date) : null, d.t1 && d.t2 ? `${ft(d.t1)} \u2013 ${ft(d.t2)}` : null, d.venue || null].filter(Boolean).join(" \u00B7 ") || "No details yet"}</div>
            </div>
            <span className={`ecn-schip ${d.status === "scheduled" ? "ecn-sch-sc" : d.status === "soldout" ? "ecn-sch-so" : "ecn-sch-dn"}`}>{SC.find(s => s.v === d.status)?.l}</span>
            {dates.length > 1 && <button className="ecn-sddel" onClick={e => { e.stopPropagation(); del(i); }}>{"\u2715"}</button>}
            <span className={`ecn-sdc${d.open ? " op" : ""}`}><I n="chev" s={16} c="var(--mu)" w={2} /></span>
          </div>
          {d.open && (
            <div className="ecn-sdbd">
              <div style={{ height: 14 }} />
              <div className="ecn-fg">
                <label className="ecn-fl">Label <span style={{ color: "var(--mu)", fontWeight: 500 }}>(optional)</span></label>
                <input className="ecn-fi" placeholder='e.g. Opening Night' value={d.label} onChange={e => upd(i, "label", e.target.value)} />
              </div>
              <div className="ecn-fr">
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Date *</label><input className="ecn-fi" type="date" value={d.date} onChange={e => upd(i, "date", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}>
                  <label className="ecn-fl">Status</label>
                  <div className="ecn-sw"><select className="ecn-fs" value={d.status} onChange={e => upd(i, "status", e.target.value)}>{SC.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
                </div>
              </div>
              <div style={{ height: 13 }} />
              <div className="ecn-fr">
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Start time *</label><input className="ecn-fi" type="time" value={d.t1} onChange={e => upd(i, "t1", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">End time *</label><input className="ecn-fi" type="time" value={d.t2} onChange={e => upd(i, "t2", e.target.value)} /></div>
              </div>
              <div style={{ height: 13 }} />
              <div className="ecn-fr">
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Venue</label><input className="ecn-fi" placeholder="e.g. Panther Stadium" value={d.venue} onChange={e => upd(i, "venue", (e.target.value || '').slice(0, 50))} maxLength={50} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Capacity</label><input className="ecn-fi" type="number" placeholder="500" value={d.cap} onChange={e => upd(i, "cap", e.target.value)} /></div>
              </div>
              <div style={{ height: 13 }} />
              <div className="ecn-fg" style={{ marginBottom: 0 }}>
                <label className="ecn-fl">Notes <span style={{ color: "var(--mu)", fontWeight: 500 }}>(optional)</span></label>
                <input className="ecn-fi" placeholder="e.g. VIP doors open early" value={d.notes} onChange={e => upd(i, "notes", e.target.value)} />
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="ecn-sdadd" onClick={() => {
        if (dates.length >= remainingSpaces && remainingSpaces > 0) {
          toast.warning(`Your plan allows ${maxAdSpaces} ad spaces total. You've used ${existingEventsCount} already.`);
          return;
        }
        add();
      }} style={dates.length >= remainingSpaces && remainingSpaces > 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}><I n="plus" s={15} c="var(--ted)" w={2} /> Add another date {remainingSpaces > 0 ? `(${Math.max(0, remainingSpaces - dates.length)} remaining)` : ""}</button>
      <div className="ecn-foot">
        <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
        <button className="ecn-bn" onClick={handleNext}>Next →</button>
      </div>
    </div>
  );
}

// ─── MEDIA ────────────────────────────────────────────────────────────────────
function P_Media({ f, u, next, back, steps, stepNum }) {
  const ref = useRef();
  const [showLightbox, setShowLightbox] = useState(false);
  const pick = e => { const fl = e.target.files[0]; if (fl) u("media", URL.createObjectURL(fl)); u("mediaFile", fl); };
  return (
    <div className="ecn-page">
      <button className="ecn-bb" style={{ marginBottom: 20 }} onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
      <div className="ecn-card">
        <div className="ecn-cs"><I n="img" s={13} c="var(--mu)" w={2} /> Advertisement Image</div>
        <div className={`ecn-upl${f.media ? " hi" : ""}`} onClick={() => !f.media && ref.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const fl = e.dataTransfer.files[0]; if (fl) { u("media", URL.createObjectURL(fl)); u("mediaFile", fl); } }}>
          {f.media
            ? <><img src={f.media} alt="preview" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setShowLightbox(true); }} /><button className="ecn-upl-del" onClick={e => { e.stopPropagation(); u("media", ""); u("mediaFile", null); }}>{"\u2715"}</button></>
            : <><I n="up" s={34} c="var(--mu)" w={1.4} /><div className="ecn-upl-tx">Drag & drop or <span className="ecn-upl-lk">browse</span></div><div className="ecn-upl-hi">JPG &middot; PNG &middot; GIF &middot; Max 10 MB</div></>
          }
          <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={pick} />
        </div>
      </div>
      <div className="ecn-foot">
        <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
        <button className="ecn-bn" onClick={next}>Next →</button>
      </div>
      {showLightbox && f.media && ReactDOM.createPortal(
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 99999, cursor: 'pointer',
            animation: 'ecnFadeIn .2s ease',
          }}
        >
          <img
            src={f.media}
            alt="Event preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)', cursor: 'default',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={() => setShowLightbox(false)}
            style={{
              position: 'absolute', top: 20, right: 20, width: 36, height: 36,
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── TICKETING ────────────────────────────────────────────────────────────────
function P_Ticketing({ f, u, next, back, steps, stepNum }) {
  const TT = [
    { id: "tabs", i: "tkt", l: "Tickets with Tabs", s: "Sell through MyTabs" },
    { id: "ext", i: "link", l: "External Link", s: "Link to another platform" },
    { id: "none", i: "ban", l: "No Tickets", s: "Free entry" },
  ];
  const [tix, setTix] = useState(f.tickets?.length ? f.tickets : [{ id: uid(), type: "General Admission", price: "", qty: "", max: "10", desc: "", showDateId: "all" }]);
  const [act, setAct] = useState(0);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPurchaseUrl, setTestPurchaseUrl] = useState('');
  const sy = t => { setTix(t); u("tickets", t); };
  const add = () => { const t = [...tix, { id: uid(), type: "", price: "", qty: "", max: "10", desc: "", showDateId: "all" }]; sy(t); setAct(t.length - 1); };
  const del = i => { if (tix.length === 1) return; const t = tix.filter((_, j) => j !== i); sy(t); setAct(Math.min(act, t.length - 1)); };
  const upd = (i, k, v) => sy(tix.map((ti, j) => j === i ? { ...ti, [k]: v } : ti));
  const tk = tix[act] || {};
  const p = parseFloat(tk.price) || 0;
  const tax = p * 0.0082;
  const s2 = p + tax;
  const tf = s2 * 0.03 + 1;
  const sf = s2 * 0.029 + 0.30;
  const pays = s2 + tf + sf;
  const $n = n => n > 0 ? `$${n.toFixed(2)}` : "$0.00";
  const fd = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014";
  const ft = t => { if (!t) return "\u2014"; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };

  const isShows = f.adType === "shows" && f.showDates?.length > 0;
  const getShowLabel = (dateId) => {
    if (dateId === "all" || !dateId) return "All Dates";
    const sd = f.showDates?.find(d => d.id === dateId);
    if (!sd) return "All Dates";
    return sd.label || (sd.date ? fd(sd.date) : "Unnamed Date");
  };

  return (
    <div className={`ecn-page${f.tickType === "tabs" ? " ecn-page-w" : ""}`}>
      {/* If type is selected, show compact pill + go back on same line */}
      {f.tickType ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
          <button className="ecn-bb" onClick={() => u("tickType", "")} style={{ background: "rgba(91,184,193,.08)", borderColor: "var(--te)", color: "var(--ted)" }}>
            <I n={TT.find(t => t.id === f.tickType)?.i || "tkt"} s={14} c="var(--ted)" w={1.7} />
            {TT.find(t => t.id === f.tickType)?.l || "Ticketing"}
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--mu)" }}>&times; change</span>
          </button>
        </div>
      ) : (
        <>
          <button className="ecn-bb" style={{ marginBottom: 20 }} onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
          <div className="ecn-card">
            <div className="ecn-cs"><I n="tkt" s={13} c="var(--mu)" w={2} /> Ticketing Type</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {TT.map(t => (
                <div key={t.id} className={`ecn-atc${f.tickType === t.id ? " ats" : ""}`} style={{ maxWidth: 190 }} onClick={() => u("tickType", t.id)}>
                  <div className="ecn-atr"><div className="ecn-atd2" /></div>
                  <I n={t.i} s={28} c={f.tickType === t.id ? "var(--ted)" : "var(--mu)"} w={1.4} />
                  <div className="ecn-at-l">{t.l}</div>
                  <div className="ecn-at-s">{t.s}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {f.tickType === "ext" && (
        <div className="ecn-card">
          <div className="ecn-fg">
            <label className="ecn-fl">Link name</label>
            <div className="ecn-fh">e.g. Buy tickets on Eventbrite</div>
            <input className="ecn-fi" placeholder="Buy tickets" value={f.extName || ""} onChange={e => u("extName", e.target.value.slice(0, 50))} maxLength={50} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>{(f.extName || '').length}/50</div>
          </div>
          <div className="ecn-fg" style={{ marginBottom: 0 }}>
            <label className="ecn-fl">External ticketing URL</label>
            <input className="ecn-fi" placeholder="https://eventbrite.com/your-event" value={f.extUrl || ""} onChange={e => u("extUrl", e.target.value)} />
          </div>
        </div>
      )}

      {f.tickType === "none" && (
        <div className="ecn-card">
          <div className="ecn-fg" style={{ marginBottom: 0 }}>
            <label className="ecn-fl">Entry label</label>
            <div className="ecn-fh">Customize what attendees see (e.g. "Free Entry", "RSVP Required", "Open Door")</div>
            <input className="ecn-fi" placeholder="Free Entry" value={f.freeName || ""} onChange={e => u("freeName", e.target.value.slice(0, 50))} maxLength={50} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>{(f.freeName || '').length}/50</div>
          </div>
        </div>
      )}

      {f.tickType === "tabs" && (
        <div className="ecn-tkt-grid">
          {/* LEFT: Ticket list */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--mu)", letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 9 }}>Tickets ({tix.length})</div>
            <div className="ecn-tc">
              {tix.map((t, i) => (
                <div key={t.id} className={`ecn-trow${act === i ? " tsel" : ""}`} onClick={() => setAct(i)}>
                  <I n="tkt" s={14} c={act === i ? "var(--te)" : "var(--mu)"} w={1.7} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ecn-tn">{t.type === "Custom" && t.customName ? t.customName : (t.type || `Ticket ${i + 1}`)}</div>
                    <div className="ecn-tm">{isShows ? getShowLabel(t.showDateId) : (t.price ? `$${t.price}` : "No price")}</div>
                  </div>
                  {tix.length > 1 && <button className="ecn-tdel" onClick={e => { e.stopPropagation(); del(i); }}>{"\u2715"}</button>}
                </div>
              ))}
              <button className="ecn-tadd" onClick={add}><I n="plus" s={14} c="var(--ted)" w={2} /> Add another</button>
            </div>
          </div>

          {/* MIDDLE: Ticket form */}
          <div>
            <div className="ecn-tform">
              <div className="ecn-fg"><label className="ecn-fl">Ticket title</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {tk.type === "Custom" && (
                    <input className="ecn-fi" style={{ flex: 1 }} placeholder="Custom ticket name" value={tk.customName || ""} onChange={e => upd(act, "customName", e.target.value)} />
                  )}
                  <div className="ecn-sw" style={{ flex: tk.type === "Custom" ? "0 0 160px" : "1" }}><select className="ecn-fs" value={tk.type} onChange={e => upd(act, "type", e.target.value)}><option value="">Select type</option>{TKTS.map(t => <option key={t}>{t}</option>)}</select></div>
                </div>
              </div>
              {isShows && (
                <div className="ecn-fg">
                  <label className="ecn-fl">Show Date *</label>
                  <div className="ecn-sw">
                    <select className="ecn-fs" value={tk.showDateId || "all"} onChange={e => upd(act, "showDateId", e.target.value)}>
                      <option value="all">All Dates</option>
                      {f.showDates.map(sd => (
                        <option key={sd.id} value={sd.id}>{sd.label || (sd.date ? fd(sd.date) : `Date ${f.showDates.indexOf(sd) + 1}`)} {sd.venue ? `\u2014 ${sd.venue}` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="ecn-fg"><label className="ecn-fl">Price (USD)</label><input className="ecn-fi" type="number" placeholder="0.00" value={tk.price} onChange={e => upd(act, "price", e.target.value)} /></div>
              <div className="ecn-fr">
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Qty available</label><input className="ecn-fi" type="number" placeholder="100" value={tk.qty} onChange={e => upd(act, "qty", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Max per customer</label><input className="ecn-fi" type="number" placeholder="10" value={tk.max} onChange={e => upd(act, "max", e.target.value)} /></div>
              </div>
              <div className="ecn-fg" style={{ marginTop: 13, marginBottom: 0 }}>
                <label className="ecn-fl">Description <span style={{ color: "var(--mu)", fontWeight: 500 }}>(optional)</span></label>
                <textarea className="ecn-fta" style={{ minHeight: 60 }} placeholder="e.g., Includes entry and one drink" value={tk.desc} onChange={e => upd(act, "desc", e.target.value)} />
              </div>
            </div>
          </div>

          {/* RIGHT: Ticket preview */}
          <div>
            <div className="ecn-pc" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}><I n="tkt" s={14} c="var(--ted)" w={2} /><span style={{ fontSize: 11, fontWeight: 900, color: "var(--ted)", letterSpacing: .5 }}>TABS TICKETS</span></div>
              <div className="ecn-pl">EVENT</div>
              <div className="ecn-pv" style={{ display: "flex", justifyContent: "space-between" }}><span>{f.name || "\u2014"}</span>{tk.type && <span className="ecn-bdg ecn-bt2">{tk.type === "Custom" && tk.customName ? tk.customName : tk.type}</span>}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><div className="ecn-pl">DATE</div><div className="ecn-pv" style={{ fontSize: 12.5 }}>{isShows ? (tk.showDateId && tk.showDateId !== "all" ? fd(f.showDates?.find(d => d.id === tk.showDateId)?.date) : "All Dates") : fd(f.date)}</div></div>
                <div><div className="ecn-pl">TIME</div><div className="ecn-pv" style={{ fontSize: 12.5 }}>{isShows ? (tk.showDateId && tk.showDateId !== "all" ? ft(f.showDates?.find(d => d.id === tk.showDateId)?.t1) : "Varies") : ft(f.t1)}</div></div>
              </div>
              <div className="ecn-pl">LOCATION</div><div className="ecn-pv" style={{ fontSize: 12.5 }}>{isShows && tk.showDateId && tk.showDateId !== "all" ? (f.showDates?.find(d => d.id === tk.showDateId)?.venue || f.venue || "\u2014") : (f.venue || "\u2014")}</div>
              <div className="ecn-fdv" />
              <div className="ecn-fee"><span>Ticket Price:</span><span>{$n(p)}</span></div>
              <div className="ecn-fee"><span>Tax:</span><span>{$n(tax)}</span></div>
              <div className="ecn-fdv" />
              <div className="ecn-fee"><span>Subtotal:</span><span>{$n(s2)}</span></div>
              <div className="ecn-fee"><span>Tabs Fee (3% + $1.00):</span><span>{$n(tf)}</span></div>
              <div className="ecn-fee"><span>Stripe Fee (~2.9% + $0.30):</span><span>{$n(sf)}</span></div>
              <div className="ecn-fdv" />
              <div className="ecn-fee fb"><span>Customer Pays:</span><span>{$n(pays)}</span></div>
              <div className="ecn-fee fg2"><span>You Receive:</span><span>{$n(p)}</span></div>
              <button className="ecn-tbtn" onClick={() => {
                if (!f.name) { toast.error("Please enter an event name first"); return; }
                const urlParams = new URLSearchParams({
                  test: 'true', admin: 'true', theme: 'light', lang: 'english',
                  preview: 'true', waitForData: 'true', eventId: 'test-preview',
                  eventName: encodeURIComponent(f.name || 'Test Event'), previewMode: 'true'
                });
                const token = localStorage.getItem("idToken");
                if (token) urlParams.set('userToken', token);
                const ticketUrl = `https://ticket.keeptabs.app/?${urlParams.toString()}#/preview`;
                setTestPurchaseUrl(ticketUrl);
                setShowTestModal(true);
                toast.success("Opening ticketing preview...");
                const sendData = () => {
                  const iframe = document.getElementById('ecn-test-iframe');
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                      type: 'MYTABS_PREVIEW_DATA',
                      eventData: {
                        id: 'test-preview', name: f.name, description: f.desc || '',
                        startDate: f.date ? moment(f.date + "T" + (f.t1 || "00:00")).toISOString() : new Date().toISOString(),
                        endDate: f.date ? moment(f.date + "T" + (f.t2 || "23:59")).toISOString() : new Date().toISOString(),
                        tickets: tix.map(t => ({ option: 'Tabs Tickets', type: t.type, price: t.price, quantity: t.qty, maxPerPurchase: parseInt(t.max) || 10, description: t.desc })),
                        hasTickets: true, ticketType: 'tabs',
                        imagePreview: f.media || null, testMode: true, adminTest: true
                      }
                    }, 'https://ticket.keeptabs.app');
                  }
                };
                setTimeout(sendData, 1000);
                setTimeout(sendData, 2000);
                setTimeout(sendData, 3000);
              }}><I n="chk" s={13} c="#fff" w={2.5} />&nbsp; Test Purchase — {$n(pays)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Test Purchase Modal */}
      {showTestModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => { setShowTestModal(false); setTestPurchaseUrl(''); }}>
          <div style={{ width: 420, height: 750, backgroundColor: "#1a1a1a", borderRadius: 25, padding: 12, display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,.3)" }} onClick={e => e.stopPropagation()}>
            {/* Phone notch */}
            <div style={{ height: 30, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
              <div style={{ width: 120, height: 20, backgroundColor: "#000", borderRadius: 10 }} />
              <button onClick={() => { setShowTestModal(false); setTestPurchaseUrl(''); }} style={{ position: "absolute", right: 5, top: 2, background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", padding: 4 }}>{"\u2715"}</button>
            </div>
            {/* Phone screen */}
            <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: 15, overflow: "hidden" }}>
              {testPurchaseUrl && (
                <iframe
                  id="ecn-test-iframe"
                  src={testPurchaseUrl}
                  title="Test purchase preview"
                  style={{ width: "100%", height: "100%", border: "none" }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                  onLoad={() => {
                    setTimeout(() => {
                      const iframe = document.getElementById('ecn-test-iframe');
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({
                          type: 'MYTABS_PREVIEW_DATA',
                          eventData: {
                            id: 'test-preview', name: f.name, description: f.desc || '',
                            startDate: f.date ? moment(f.date + "T" + (f.t1 || "00:00")).toISOString() : new Date().toISOString(),
                            endDate: f.date ? moment(f.date + "T" + (f.t2 || "23:59")).toISOString() : new Date().toISOString(),
                            tickets: tix.map(t => ({ option: 'Tabs Tickets', type: t.type, price: t.price, quantity: t.qty, maxPerPurchase: parseInt(t.max) || 10, description: t.desc })),
                            hasTickets: true, ticketType: 'tabs',
                            imagePreview: f.media || null, testMode: true, adminTest: true
                          }
                        }, 'https://ticket.keeptabs.app');
                      }
                    }, 500);
                  }}
                />
              )}
            </div>
            {/* Phone bottom */}
            <div style={{ height: 20, borderRadius: "0 0 15px 15px" }} />
          </div>
        </div>
      )}

      <div className="ecn-foot">
        <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
        <button className="ecn-bn" onClick={() => {
          if (!f.tickType) { toast.error("Please select a ticketing type"); return; }
          if (f.tickType === "tabs") {
            const invalid = tix.some(t => !t.type || !t.price || !t.qty);
            if (invalid) { toast.error("Each ticket needs a title, price, and quantity"); return; }
            const invalidPrice = tix.some(t => isNaN(t.price) || parseFloat(t.price) <= 0);
            if (invalidPrice) { toast.error("Ticket price must be greater than $0"); return; }
            const invalidCustom = tix.some(t => t.type === "Custom" && !t.customName);
            if (invalidCustom) { toast.error("Please enter a name for custom tickets"); return; }
          }
          if (f.tickType === "ext" && !f.extUrl) { toast.error("Please enter an external ticketing URL"); return; }
          next();
        }}>Next →</button>
      </div>
    </div>
  );
}

// ─── KPIs + ALERTS ────────────────────────────────────────────────────────────
function P_KPIs({ f, u, next, back, steps, stepNum }) {
  const [kpis, setK] = useState(f.kpis || []);
  const [chs, setCh] = useState(f.channels || CHS.reduce((a, c) => ({ ...a, [c.id]: c.on }), {}));
  const [cps, setCp] = useState(f.checkpoints || [90, 30, 14, 7]);
  const [tab, setTab] = useState("kpis");
  const sy = k => { setK(k); u("kpis", k); };
  const addK = () => sy([...kpis, { id: uid(), label: "", type: "number", target: "", cur: "", unit: "", alert: 70 }]);
  const delK = i => sy(kpis.filter((_, j) => j !== i));
  const updK = (i, k, v) => sy(kpis.map((ki, j) => j === i ? { ...ki, [k]: v } : ki));
  const togC = id => { const n = { ...chs, [id]: !chs[id] }; setCh(n); u("channels", n); };
  const togP = d => { const n = cps.includes(d) ? cps.filter(x => x !== d) : [...cps, d]; setCp(n); u("checkpoints", n); };
  const PR = [
    { l: "Ticket Sales", t: "number", u2: "tickets", g: "500" },
    { l: "Revenue", t: "currency", u2: "$", g: "10000" },
    { l: "Attendance", t: "number", u2: "attendees", g: "500" },
    { l: "Social Reach", t: "number", u2: "impressions", g: "50000" },
    { l: "Sponsorship $", t: "currency", u2: "$", g: "5000" },
  ];

  return (
    <div className="ecn-page">
      <button className="ecn-bb" style={{ marginBottom: 20 }} onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>

      <div className="ecn-st">
        {[["kpis", "KPI Goals"], ["notifs", "Notifications"]].map(([id, lb]) => (
          <button key={id} className={`ecn-stb ${tab === id ? "on" : "off"}`} onClick={() => setTab(id)}>{lb}</button>
        ))}
      </div>

      {tab === "kpis" && <>
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--mu)", letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 9 }}>Quick-add presets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {PR.map(p => <button key={p.l} className="ecn-pp" onClick={() => sy([...kpis, { id: uid(), label: p.l, type: p.t, target: p.g, cur: "0", unit: p.u2, alert: 70 }])}>+ {p.l}</button>)}
          </div>
        </div>
        {kpis.length === 0
          ? <div className="ecn-ek"><div style={{ fontSize: 32, marginBottom: 7 }}>{"\uD83D\uDCCA"}</div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No KPI goals yet</div><div style={{ fontSize: 12.5, color: "var(--mu)" }}>Use a preset or add a custom KPI below</div></div>
          : kpis.map((k, i) => (
            <div key={k.id} className="ecn-kc">
              <button className="ecn-kd" onClick={() => delK(i)}>{"\u2715"}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span className="ecn-kn">#{i + 1}</span><span style={{ fontSize: 12, fontWeight: 700, color: "var(--mu)" }}>KPI Goal</span></div>
              <div className="ecn-fr" style={{ marginBottom: 12 }}>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">KPI Name *</label><input className="ecn-fi" placeholder="e.g. Ticket Sales" value={k.label} onChange={e => updK(i, "label", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Metric Type</label><div className="ecn-sw"><select className="ecn-fs" value={k.type} onChange={e => updK(i, "type", e.target.value)}>{KT.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div></div>
              </div>
              <div className="ecn-fr3" style={{ marginBottom: 12 }}>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Target *</label><input className="ecn-fi" type="number" placeholder="1000" value={k.target} onChange={e => updK(i, "target", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Starting Value</label><input className="ecn-fi" type="number" placeholder="0" value={k.cur} onChange={e => updK(i, "cur", e.target.value)} /></div>
                <div className="ecn-fg" style={{ marginBottom: 0 }}><label className="ecn-fl">Unit</label><input className="ecn-fi" placeholder="tickets, $" value={k.unit} onChange={e => updK(i, "unit", e.target.value)} /></div>
              </div>
              <label className="ecn-fl" style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>Alert Threshold</span><span className="ecn-bdg ecn-bo2">{k.alert}% of target</span></label>
              <input type="range" className="ecn-ri" min={20} max={95} value={k.alert} style={{ "--p": k.alert + "%" }} onChange={e => updK(i, "alert", Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--mu)", marginTop: 5 }}><span>20% lenient</span><span>Alert fires below {k.alert}%</span><span>95% strict</span></div>
            </div>
          ))
        }
        <button className="ecn-kadd" onClick={addK} style={{ marginTop: 11 }}><I n="plus" s={15} c="var(--ted)" w={2} /> Add KPI Goal</button>
      </>}

      {tab === "notifs" && <>
        <div className="ecn-card" style={{ marginBottom: 15 }}>
          <div className="ecn-cs"><I n="clk" s={13} c="var(--mu)" w={2} /> Operational Checkpoints</div>
          <div style={{ fontSize: 12.5, color: "var(--mu)", marginBottom: 12 }}>Alerts dispatch at each selected day-before-event checkpoint when KPIs fall below threshold.</div>
          <div className="ecn-cpg">{[90, 60, 30, 21, 14, 7, 3, 1].map(d => <button key={d} className={`ecn-cpb ${cps.includes(d) ? "on" : "off"}`} onClick={() => togP(d)}>{d} day{d !== 1 ? "s" : ""}</button>)}</div>
          {cps.length > 0 && <div style={{ marginTop: 11, fontSize: 11.5, color: "var(--mu)", background: "rgba(245,166,35,.07)", padding: "8px 12px", borderRadius: 8 }}><strong>Active:</strong> {[...cps].sort((a, b) => b - a).join(", ")} days before</div>}
        </div>
        <div className="ecn-card" style={{ marginBottom: 15 }}>
          <div className="ecn-cs"><I n="bell" s={13} c="var(--mu)" w={2} /> Notification Channels</div>
          {CHS.map(ch => (
            <div key={ch.id} className={`ecn-chr${chs[ch.id] ? " on" : ""}`}>
              <div className="ecn-chl"><I n={ch.ic} s={19} c={chs[ch.id] ? "var(--te)" : "var(--mu)"} w={1.6} /><div><div className="ecn-chn">{ch.n}</div><div className="ecn-chd">{ch.d}</div></div></div>
              <button className={`ecn-tog ${chs[ch.id] ? "on" : "off"}`} onClick={() => togC(ch.id)}><div className="ecn-tok" /></button>
            </div>
          ))}
        </div>
        <div className="ecn-card">
          <div className="ecn-cs"><I n="bar" s={13} c="var(--mu)" w={2} /> Escalation Levels</div>
          {[["Info", "#3b82f6", "On track", "\u2265 80%"], ["Watch", "#f59e0b", "Approaching threshold", "65\u201379%"], ["Warning", "#f97316", "Below threshold", "50\u201364%"], ["Critical", "#ef4444", "Critically behind", "< 50%"]].map(([l, c, d, t], i, a) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < a.length - 1 ? "1px solid rgba(0,0,0,.04)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
                <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{l}</div><div style={{ fontSize: 11.5, color: "var(--mu)", marginTop: 2 }}>{d}</div></div>
              </div>
              <span className="ecn-bdg" style={{ background: c + "18", color: c }}>{t}</span>
            </div>
          ))}
        </div>
      </>}

      <div className="ecn-foot">
        <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
        <div className="ecn-fr2"><button className="ecn-bsk" onClick={next}>Skip</button><button className="ecn-bn" onClick={next}>Next →</button></div>
      </div>
    </div>
  );
}

// ─── REVIEW ───────────────────────────────────────────────────────────────────
function P_Review({ f, goTo, submit, back, steps, isShows, selectedBusinessId, allBusinesses }) {
  const fd = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }) : "\u2014";
  const ft = t => { if (!t) return "\u2014"; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
  const CHN = CHS.reduce((a, c) => ({ ...a, [c.id]: c.n }), {});
  const bizName = allBusinesses?.find(b => b.linkedBusinessId === selectedBusinessId)?.name || selectedBusinessId || "—";

  return (
    <div className="ecn-page">
      <button className="ecn-bb" style={{ marginBottom: 20 }} onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>

      <div className="ecn-rv-s">
        <div className="ecn-rv-h"><div className="ecn-rv-t"><I n="cal" s={13} c="var(--tx)" w={2} /> {isShows ? "Show" : "Event"} Details</div><button className="ecn-rv-e" onClick={() => goTo(1)}>Edit</button></div>
        <div className="ecn-rv-r"><span className="ecn-rv-l">Business</span><span className="ecn-rv-v" style={{ color: '#0099bb', fontWeight: 800 }}>{bizName}</span></div>
        {[{ l: "Name", v: f.name || "\u2014" }, { l: "Category", v: f.cat || "\u2014" }, { l: "Venue", v: f.venue || "\u2014" }, { l: "Capacity", v: f.cap ? Number(f.cap).toLocaleString() : "\u2014" }, { l: "Visibility", v: ({ public: "Public", business: "Business", private: "Private" })[f.visibility] || "Public" }, ...(!isShows ? [{ l: "Date", v: fd(f.date) }, { l: "Time", v: `${ft(f.t1)} \u2013 ${ft(f.t2)}` }] : [])].map(r => (
          <div key={r.l} className="ecn-rv-r"><span className="ecn-rv-l">{r.l}</span><span className="ecn-rv-v">{r.v}</span></div>
        ))}
      </div>

      {isShows && f.showDates?.length > 0 && (
        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t"><I n="film" s={13} c="var(--tx)" w={2} /> Show Dates ({f.showDates.length})</div><button className="ecn-rv-e" onClick={() => goTo(2)}>Edit</button></div>
          {f.showDates.map((d, i) => (
            <div key={d.id} className="ecn-rv-r">
              <span className="ecn-rv-l">{d.label || `Date ${i + 1}`}</span>
              <span className="ecn-rv-v">{fd(d.date)}{d.t1 ? ` \u00B7 ${ft(d.t1)}` : ""}{d.venue ? ` \u00B7 ${d.venue}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ecn-rv-s">
        <div className="ecn-rv-h"><div className="ecn-rv-t"><I n="tkt" s={13} c="var(--tx)" w={2} /> Ticketing</div><button className="ecn-rv-e" onClick={() => goTo(isShows ? 4 : 3)}>Edit</button></div>
        <div className="ecn-rv-r"><span className="ecn-rv-l">Type</span><span className="ecn-rv-v">{{ tabs: "Tickets with Tabs", ext: "External Link", none: "No Tickets", "": "\u2014" }[f.tickType] || "\u2014"}</span></div>
        {f.tickType === "tabs" && f.tickets?.map((t, i) => (
          <div key={t.id} className="ecn-rv-r"><span className="ecn-rv-l">{t.type || `Ticket ${i + 1}`}{isShows && t.showDateId && t.showDateId !== "all" ? ` \u2014 ${f.showDates?.find(d => d.id === t.showDateId)?.label || fd(f.showDates?.find(d => d.id === t.showDateId)?.date)}` : isShows ? " \u2014 All Dates" : ""}</span><span className="ecn-rv-v">${t.price || "0.00"} &middot; {t.qty || "\u2014"} available</span></div>
        ))}
        {f.tickType === "ext" && (
          <>
            <div className="ecn-rv-r"><span className="ecn-rv-l">Link name</span><span className="ecn-rv-v">{f.extName || "External Links"}</span></div>
            <div className="ecn-rv-r"><span className="ecn-rv-l">URL</span><span className="ecn-rv-v">{f.extUrl || "\u2014"}</span></div>
          </>
        )}
        {f.tickType === "none" && (
          <div className="ecn-rv-r"><span className="ecn-rv-l">Entry label</span><span className="ecn-rv-v">{f.freeName || "Free Entry"}</span></div>
        )}
      </div>

      {f.kpis?.length > 0 && (
        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t"><I n="bar" s={13} c="var(--tx)" w={2} /> KPI Goals ({f.kpis.length})</div><button className="ecn-rv-e" onClick={() => goTo(isShows ? 5 : 4)}>Edit</button></div>
          <div style={{ display: "flex", flexWrap: "wrap", paddingTop: 3 }}>
            {f.kpis.map(k => <span key={k.id} className="ecn-kpill"><I n="bar" s={9} c="var(--or)" w={2} /> {k.label} — {k.type === "currency" ? "$" : ""}{k.target} {k.type !== "currency" ? k.unit : ""}</span>)}
          </div>
        </div>
      )}

      <div className="ecn-rv-s">
        <div className="ecn-rv-h"><div className="ecn-rv-t"><I n="bell" s={13} c="var(--tx)" w={2} /> Notifications</div><button className="ecn-rv-e" onClick={() => goTo(isShows ? 5 : 4)}>Edit</button></div>
        <div className="ecn-rv-r"><span className="ecn-rv-l">Checkpoints</span><span className="ecn-rv-v">{f.checkpoints?.length > 0 ? [...f.checkpoints].sort((a, b) => b - a).join(", ") + " days" : "None"}</span></div>
        <div className="ecn-rv-r"><span className="ecn-rv-l">Channels</span><span className="ecn-rv-v">{f.channels ? Object.entries(f.channels).filter(([, v]) => v).map(([k]) => CHN[k]).join(", ") || "None" : "Default"}</span></div>
      </div>

      <div className="ecn-ok-box">
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 7 }}><I n="chk" s={13} c="var(--ted)" w={2.5} /> Ready to launch</div>
        <div style={{ fontSize: 13, color: "var(--tx)", lineHeight: 1.7 }}><strong>{f.name || "Your event"}</strong> will publish with <strong>{f.kpis?.length || 0} KPI goals</strong> and <strong>{f.checkpoints?.length || 0} checkpoints</strong>{isShows ? ` across ${f.showDates?.length || 0} show dates` : ""}.
        </div>
      </div>

      <div className="ecn-foot">
        <button className="ecn-bb" onClick={back}><I n="chevL" s={13} w={2.5} /> Go back</button>
        <div className="ecn-fr2">
          <button className="ecn-bsk" onClick={() => submit("draft")}>Save as Draft</button>
          <button className="ecn-bla" onClick={() => submit("launch")}>{"\uD83D\uDE80"} Launch</button>
        </div>
      </div>
    </div>
  );
}

// ─── SUCCESS ──────────────────────────────────────────────────────────────────
function Done({ f, reset, isShows }) {
  const fd = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "\u2014";
  return (
    <div className="ecn-succ">
      <div className="ecn-si">{"\uD83C\uDF89"}</div>
      <div className="ecn-sh">{isShows ? "Show Launched!" : "Event Launched!"}</div>
      <div className="ecn-ss2"><strong>{f.name}</strong> is now live. KPI tracking is active and your team will receive automated alerts at each checkpoint.</div>
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="ecn-bla" onClick={reset} style={{ padding: "12px 28px", fontSize: 14 }}>+ Create Another</button>
        <button className="ecn-bb" style={{ padding: "12px 22px", fontSize: 13.5 }} onClick={() => window.location.href = "/admin/my-events"}>View Dashboard</button>
      </div>
      {isShows && f.showDates?.length > 0 && (
        <div style={{ marginTop: 26, background: "rgba(255,255,255,.85)", borderRadius: 15, padding: "18px 22px", boxShadow: "0 4px 20px rgba(0,0,0,.07)", textAlign: "left", maxWidth: 460, width: "100%" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--mu)", letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 11 }}>Show Dates ({f.showDates.length})</div>
          {f.showDates.map((d, i) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,.05)", fontSize: 13 }}>
              <div><span style={{ fontWeight: 700 }}>{d.label || `Date ${i + 1}`}</span><span style={{ color: "var(--mu)", marginLeft: 8 }}>{fd(d.date)}</span></div>
              <span className="ecn-bdg ecn-bt2">{d.venue || "\u2014"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const parseJwt = (token) => {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(jsonPayload)["custom:user_id"];
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return null;
  }
};

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const INIT = {
  adType: "", name: "", cat: "Athletics", date: "", t1: "", t2: "",
  cap: "", desc: "", venue: "", loc: "biz", addr: "", city: "", zip: "",
  media: "", mediaFile: null, tickType: "", extUrl: "", tickets: [],
  kpis: [], checkpoints: [90, 30, 14, 7], channels: null, showDates: [],
  visibility: "public",
  eventCode: "",
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const PLAN_LIMITS = { 1: 3, 2: 10, 3: 25 }; // Basic: 3, Plus: 10, Premium: 25

const EventCreateNew = ({ editMode = false, editData = null, eventId = null }) => {
  const [step, setStep] = useState(editMode ? 1 : 1);
  const [form, setForm] = useState(editData || INIT);
  const [done, setDone] = useState(false);
  const [, setSubmitting] = useState(false);
  const [maxAdSpaces, setMaxAdSpaces] = useState(3);
  const [existingEventsCount, setExistingEventsCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    // In edit mode, prefer the event's own businessId over sessionStorage
    (editMode && editData?.businessId) || sessionStorage.getItem("selectedBusinessId") || null
  );
  const navigate = useNavigate();

  // Fetch subscription level and existing events count on mount
  useEffect(() => {
    const fetchPlanData = async () => {
      try {
        const token = localStorage.getItem("idToken");
        const userId = parseJwt(token);
        if (!userId) return;

        let subscriptionLevel = 1;
        try {
          const systemSubsRes = await getSystemSubscriptions();
          const customerSubRes = await getCustomerSubscription({ userId });
          if (customerSubRes?.data?.hasSubscription && customerSubRes?.data?.priceId) {
            const subItem = systemSubsRes?.data?.find(el => el.priceId === customerSubRes.data.priceId);
            if (subItem) subscriptionLevel = subItem.level;
          }
        } catch (e) { console.error("Subscription fetch error:", e); }

        const totalSpaces = PLAN_LIMITS[subscriptionLevel] || 3;
        setMaxAdSpaces(totalSpaces);

        try {
          const eventsRes = await getEventsByUserId(userId);
          setExistingEventsCount(eventsRes.data?.length || 0);
        } catch (e) { console.error("Events count fetch error:", e); }

        // Fetch organization businesses for the business selector
        try {
          const orgRes = await getMyOrganizations();
          const orgs = orgRes?.data?.organizations || orgRes?.data || [];
          if (orgs.length > 0) {
            const orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
            const orgName = orgs[0].name || 'Organization';
            const orgRole = orgs[0].role || 'member';
            const bizRes = await getOrganizationBusinesses(orgId).catch(() => null);
            const businesses = bizRes?.data?.businesses || bizRes?.data || [];
            const allBiz = [];
            if (orgRole === 'owner') {
              // Use the actual business _id, not userId
              let ownerBizId = userId;
              try {
                const ownerBizRes = await getBusiness(userId);
                const ownerBiz = ownerBizRes?.data || ownerBizRes;
                if (ownerBiz?._id) ownerBizId = ownerBiz._id;
              } catch (e) { /* fallback to userId */ }
              allBiz.push({ linkedBusinessId: ownerBizId, userId: userId, name: orgName, isPayer: true });
            }
            allBiz.push(...businesses.filter(b => b.linkedBusinessId !== userId));
            setAllBusinesses(allBiz);

            // Fetch businessCode for the owner's business if not already present
            try {
              const ownerBizRes = await getBusiness(userId);
              const ownerBiz = ownerBizRes?.data || ownerBizRes;
              if (ownerBiz?.businessCode && allBiz[0]?.isPayer) {
                allBiz[0].businessCode = ownerBiz.businessCode;
                setAllBusinesses([...allBiz]);
              }
            } catch (e) { /* non-critical */ }

            // Validate that the saved selectedBusinessId is still valid
            // In edit mode, prefer the event's own businessId
            const eventBizId = editMode && editData?.businessId ? editData.businessId : null;
            const savedBiz = eventBizId || sessionStorage.getItem("selectedBusinessId");
            if (savedBiz && allBiz.some(b => b.linkedBusinessId === savedBiz)) {
              setSelectedBusinessId(savedBiz);
            } else if (allBiz.length > 0) {
              const defaultBiz = allBiz[0].linkedBusinessId;
              setSelectedBusinessId(defaultBiz);
              sessionStorage.setItem("selectedBusinessId", defaultBiz);
            }
          }
        } catch (e) { console.error("Organization fetch error:", e); }
      } catch (e) { console.error("Plan data fetch error:", e); }
    };
    fetchPlanData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isShows = form.adType === "shows";
  const steps = isShows ? SS : SE;
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);
  const goTo = n => setStep(n);
  const reset = () => { setForm(INIT); setStep(1); setDone(false); };

  // Delete event handler
  const handleDeleteEvent = async () => {
    if (!eventId) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      await deleteEvent({ userId, _id: eventId });
      toast.success("Event deleted successfully");
      navigate("/admin/my-events");
    } catch (error) {
      console.error("Delete event error:", error);
      toast.error("Failed to delete event. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Submit event to backend
  const handleSubmit = async (mode = "launch") => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);

      // Build event payload matching existing API contract
      const payload = {
        name: form.name,
        description: form.desc || "",
        startDate: form.adType === "shows" && form.showDates?.[0]
          ? moment(form.showDates[0].date + "T" + (form.showDates[0].t1 || "00:00")).toString()
          : moment(form.date + "T" + (form.t1 || "00:00")).toString(),
        endDate: form.adType === "shows" && form.showDates?.[0]
          ? moment(form.showDates[0].date + "T" + (form.showDates[0].t2 || "23:59")).toString()
          : moment(form.date + "T" + (form.t2 || "23:59")).toString(),
        userId,
        city: form.city || "",
        state: "",
        address1: form.loc === "new" ? form.addr : "",
        zipCode: form.zip || "",
        venue: form.venue || "",
        visibility: form.visibility || "public",
        status: mode === "draft" ? "inactive" : "active",
        isActive: mode !== "draft",
        hasTickets: form.tickType === "tabs" && form.tickets?.length > 0,
        ticketType: form.tickType === "tabs" ? "tabs" : form.tickType === "ext" ? "external" : "free",
      };

      // Attach the selected business so events are correctly associated.
      // businessId comes from the component state (synced with sessionStorage
      // and validated against the org's business list on mount).
      const selectedBizId = selectedBusinessId || userId;
      payload.businessId = selectedBizId;
      try {
        const bizRes = await getBusiness(userId, selectedBizId !== userId ? selectedBizId : undefined);
        const biz = bizRes?.data || bizRes;
        if (biz?.businessCode) {
          payload.businessCode = biz.businessCode;
        }
      } catch (e) {
        // Non-critical — event still saves without businessCode.
        console.warn("Could not resolve businessCode:", e);
      }

      // Map tickets to API format
      if (form.tickType === "tabs" && form.tickets?.length > 0) {
        payload.tickets = form.tickets.map(t => ({
          option: "Tabs Tickets",
          type: t.type === "Custom" && t.customName ? t.customName : (t.type || "General Admission"),
          price: t.price || "0",
          quantity: t.qty || "0",
          maxPerPurchase: parseInt(t.max) || 10,
          description: t.desc || "",
          showDateId: t.showDateId || "all",
        }));
      } else if (form.tickType === "ext") {
        payload.tickets = [{ option: "External link", type: form.extName || "External Links", link1: form.extUrl || "" }];
      } else {
        payload.tickets = [{ option: "Free", type: form.freeName || "Free Entry" }];
      }

      // Add show dates if applicable
      if (isShows && form.showDates?.length > 0) {
        payload.showDates = form.showDates;
      }

      // Add KPIs if set
      if (form.kpis?.length > 0) {
        payload.kpis = form.kpis;
      }
      if (form.checkpoints) {
        payload.checkpoints = form.checkpoints;
      }
      if (form.channels) {
        payload.channels = form.channels;
      }

      // Create or Update event
      let data;
      if (editMode && eventId) {
        payload._id = eventId;
        const res = await updateEvent(payload);
        data = res.data;
        // Sync sessionStorage so EventsView shows the correct business filter
        if (selectedBusinessId) {
          sessionStorage.setItem("selectedBusinessId", selectedBusinessId);
        }
        toast.success(mode === "draft" ? "Event saved as draft!" : "Event updated!");
      } else {
        const res = await createEvent(payload);
        data = res.data;
        toast.success(mode === "draft" ? "Draft saved!" : "Event Created!");
      }

      // Upload image if a new file was selected
      if (form.mediaFile) {
        try {
          const presignedRes = await getPresignedUrlForEvent({ id: data._id, userId });
          const presignedUrl = presignedRes.data;
          const base64Response = await fetch(form.media);
          const blob = await base64Response.blob();
          await axios.put(presignedUrl, blob);
          toast.success("Image uploaded successfully!");
        } catch (imgErr) {
          console.error("Image upload error:", imgErr);
          toast.warning("Event created but image upload failed");
        }
      }

      setDone(true);
    } catch (error) {
      console.error("Event save error:", error);
      toast.error(editMode ? "Failed to update event." : "Failed to create event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Shared props
  const sp = { f: form, u, next, back, steps };

  const handleSideImageUpload = (file) => {
    u("media", URL.createObjectURL(file));
    u("mediaFile", file);
  };

  return (
    <>
      <style>{G}</style>
      <div className="ecn-wrap">
        {done ? <Done f={form} reset={reset} isShows={isShows} /> : (
          <>
            {/* Title + Step Wizard above the layout */}
            <div className="ecn-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="ecn-pg-h" style={{ marginBottom: 0 }}>{editMode ? "Edit Event" : "Create Event"}</div>
              </div>
              <div className="ecn-steps" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button className="ecn-bb" onClick={() => navigate("/admin/my-events")} style={{ margin: 0 }}><I n="chevL" s={13} w={2.5} /> <span className="ecn-bb-full">Back to Events</span><span className="ecn-bb-short">Back</span></button>
                {steps.map(s => (
                  <button key={s.n} className={`ecn-step-btn${step === s.n ? " cur" : step > s.n ? " done" : ""}`}>
                    {step > s.n ? "\u2713 " : ""}{s.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="ecn-layout">
              {/* Hide side panel on ticketing step — it uses its own 3-col layout */}
              {!((!isShows && step === 3) || (isShows && step === 4)) && (
                <SidePanel f={form} onImageUpload={handleSideImageUpload} businessCode={allBusinesses.find(b => b.linkedBusinessId === selectedBusinessId)?.businessCode || ''} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {step === 1 && <P1 {...sp} editMode={editMode} eventId={eventId} onDelete={() => setShowDeleteModal(true)} allBusinesses={allBusinesses} selectedBusinessId={selectedBusinessId} onBusinessChange={(bizId) => {
                  setSelectedBusinessId(bizId);
                  sessionStorage.setItem("selectedBusinessId", bizId);
                  u("eventCode", "");
                }} previewEventCode={(() => {
                  const bc = allBusinesses.find(b => b.linkedBusinessId === selectedBusinessId)?.businessCode || '';
                  let seg = 'XXXX';
                  if (bc) { const m = bc.match(/BIZ-([A-Z0-9]{4})/); seg = m ? m[1] : bc.replace(/[^A-Z0-9]/g, '').slice(-4) || 'XXXX'; }
                  return `BIZ-${seg}-EVT-${(form.name || '').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'XXXX'}`;
                })()} />}

                {/* Event flow */}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {!isShows && step === 2 && <P_Media {...sp} stepNum={2} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {!isShows && step === 3 && <P_Ticketing {...sp} stepNum={3} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {!isShows && step === 4 && <P_KPIs {...sp} stepNum={4} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {!isShows && step === 5 && <P_Review f={form} goTo={goTo} submit={handleSubmit} back={back} steps={steps} isShows={false} selectedBusinessId={selectedBusinessId} allBusinesses={allBusinesses} />}

                {/* Shows flow */}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {isShows && step === 2 && <P_ShowDates f={form} u={u} next={next} back={back} maxAdSpaces={maxAdSpaces} existingEventsCount={existingEventsCount} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {isShows && step === 3 && <P_Media {...sp} stepNum={3} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {isShows && step === 4 && <P_Ticketing {...sp} stepNum={4} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {isShows && step === 5 && <P_KPIs {...sp} stepNum={5} />}
                {/* eslint-disable-next-line react/jsx-pascal-case */}
                {isShows && step === 6 && <P_Review f={form} goTo={goTo} submit={handleSubmit} back={back} steps={steps} isShows={true} selectedBusinessId={selectedBusinessId} allBusinesses={allBusinesses} />}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="ecn-modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="ecn-modal" onClick={e => e.stopPropagation()}>
            <div className="ecn-modal-icon">
              <I n="warn" s={28} c="#ef4444" w={2} />
            </div>
            <div className="ecn-modal-title">Delete Event?</div>
            <div className="ecn-modal-msg">
              Are you sure you want to delete "<strong>{form.name || 'this event'}</strong>"? This action cannot be undone and all associated data will be permanently removed.
            </div>
            <div className="ecn-modal-btns">
              <button 
                className="ecn-modal-cancel" 
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="ecn-modal-confirm" 
                onClick={handleDeleteEvent}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventCreateNew;
