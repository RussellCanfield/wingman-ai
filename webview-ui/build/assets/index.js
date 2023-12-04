var Hf=Object.defineProperty;var jf=(t,e,n)=>e in t?Hf(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var nu=(t,e,n)=>(jf(t,typeof e!="symbol"?e+"":e,n),n);const Uf=function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function n(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerpolicy&&(o.referrerPolicy=r.referrerpolicy),r.crossorigin==="use-credentials"?o.credentials="include":r.crossorigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(r){if(r.ep)return;r.ep=!0;const o=n(r);fetch(r.href,o)}};Uf();var Bo={exports:{}},z={};/*
object-assign
(c) Sindre Sorhus
@license MIT
*/var iu=Object.getOwnPropertySymbols,Wf=Object.prototype.hasOwnProperty,Qf=Object.prototype.propertyIsEnumerable;function qf(t){if(t==null)throw new TypeError("Object.assign cannot be called with null or undefined");return Object(t)}function Gf(){try{if(!Object.assign)return!1;var t=new String("abc");if(t[5]="de",Object.getOwnPropertyNames(t)[0]==="5")return!1;for(var e={},n=0;n<10;n++)e["_"+String.fromCharCode(n)]=n;var i=Object.getOwnPropertyNames(e).map(function(o){return e[o]});if(i.join("")!=="0123456789")return!1;var r={};return"abcdefghijklmnopqrst".split("").forEach(function(o){r[o]=o}),Object.keys(Object.assign({},r)).join("")==="abcdefghijklmnopqrst"}catch{return!1}}var td=Gf()?Object.assign:function(t,e){for(var n,i=qf(t),r,o=1;o<arguments.length;o++){n=Object(arguments[o]);for(var s in n)Wf.call(n,s)&&(i[s]=n[s]);if(iu){r=iu(n);for(var l=0;l<r.length;l++)Qf.call(n,r[l])&&(i[r[l]]=n[r[l]])}}return i};/** @license React v17.0.2
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Vl=td,Jn=60103,nd=60106;z.Fragment=60107;z.StrictMode=60108;z.Profiler=60114;var id=60109,rd=60110,od=60112;z.Suspense=60113;var sd=60115,ld=60116;if(typeof Symbol=="function"&&Symbol.for){var Ye=Symbol.for;Jn=Ye("react.element"),nd=Ye("react.portal"),z.Fragment=Ye("react.fragment"),z.StrictMode=Ye("react.strict_mode"),z.Profiler=Ye("react.profiler"),id=Ye("react.provider"),rd=Ye("react.context"),od=Ye("react.forward_ref"),z.Suspense=Ye("react.suspense"),sd=Ye("react.memo"),ld=Ye("react.lazy")}var ru=typeof Symbol=="function"&&Symbol.iterator;function Yf(t){return t===null||typeof t!="object"?null:(t=ru&&t[ru]||t["@@iterator"],typeof t=="function"?t:null)}function vr(t){for(var e="https://reactjs.org/docs/error-decoder.html?invariant="+t,n=1;n<arguments.length;n++)e+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+t+"; visit "+e+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var ad={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},ud={};function Kn(t,e,n){this.props=t,this.context=e,this.refs=ud,this.updater=n||ad}Kn.prototype.isReactComponent={};Kn.prototype.setState=function(t,e){if(typeof t!="object"&&typeof t!="function"&&t!=null)throw Error(vr(85));this.updater.enqueueSetState(this,t,e,"setState")};Kn.prototype.forceUpdate=function(t){this.updater.enqueueForceUpdate(this,t,"forceUpdate")};function cd(){}cd.prototype=Kn.prototype;function Hl(t,e,n){this.props=t,this.context=e,this.refs=ud,this.updater=n||ad}var jl=Hl.prototype=new cd;jl.constructor=Hl;Vl(jl,Kn.prototype);jl.isPureReactComponent=!0;var Ul={current:null},dd=Object.prototype.hasOwnProperty,hd={key:!0,ref:!0,__self:!0,__source:!0};function fd(t,e,n){var i,r={},o=null,s=null;if(e!=null)for(i in e.ref!==void 0&&(s=e.ref),e.key!==void 0&&(o=""+e.key),e)dd.call(e,i)&&!hd.hasOwnProperty(i)&&(r[i]=e[i]);var l=arguments.length-2;if(l===1)r.children=n;else if(1<l){for(var a=Array(l),u=0;u<l;u++)a[u]=arguments[u+2];r.children=a}if(t&&t.defaultProps)for(i in l=t.defaultProps,l)r[i]===void 0&&(r[i]=l[i]);return{$$typeof:Jn,type:t,key:o,ref:s,props:r,_owner:Ul.current}}function Xf(t,e){return{$$typeof:Jn,type:t.type,key:e,ref:t.ref,props:t.props,_owner:t._owner}}function Wl(t){return typeof t=="object"&&t!==null&&t.$$typeof===Jn}function Zf(t){var e={"=":"=0",":":"=2"};return"$"+t.replace(/[=:]/g,function(n){return e[n]})}var ou=/\/+/g;function cs(t,e){return typeof t=="object"&&t!==null&&t.key!=null?Zf(""+t.key):e.toString(36)}function Yr(t,e,n,i,r){var o=typeof t;(o==="undefined"||o==="boolean")&&(t=null);var s=!1;if(t===null)s=!0;else switch(o){case"string":case"number":s=!0;break;case"object":switch(t.$$typeof){case Jn:case nd:s=!0}}if(s)return s=t,r=r(s),t=i===""?"."+cs(s,0):i,Array.isArray(r)?(n="",t!=null&&(n=t.replace(ou,"$&/")+"/"),Yr(r,e,n,"",function(u){return u})):r!=null&&(Wl(r)&&(r=Xf(r,n+(!r.key||s&&s.key===r.key?"":(""+r.key).replace(ou,"$&/")+"/")+t)),e.push(r)),1;if(s=0,i=i===""?".":i+":",Array.isArray(t))for(var l=0;l<t.length;l++){o=t[l];var a=i+cs(o,l);s+=Yr(o,e,n,a,r)}else if(a=Yf(t),typeof a=="function")for(t=a.call(t),l=0;!(o=t.next()).done;)o=o.value,a=i+cs(o,l++),s+=Yr(o,e,n,a,r);else if(o==="object")throw e=""+t,Error(vr(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e));return s}function Rr(t,e,n){if(t==null)return t;var i=[],r=0;return Yr(t,i,"","",function(o){return e.call(n,o,r++)}),i}function Jf(t){if(t._status===-1){var e=t._result;e=e(),t._status=0,t._result=e,e.then(function(n){t._status===0&&(n=n.default,t._status=1,t._result=n)},function(n){t._status===0&&(t._status=2,t._result=n)})}if(t._status===1)return t._result;throw t._result}var pd={current:null};function gt(){var t=pd.current;if(t===null)throw Error(vr(321));return t}var Kf={ReactCurrentDispatcher:pd,ReactCurrentBatchConfig:{transition:0},ReactCurrentOwner:Ul,IsSomeRendererActing:{current:!1},assign:Vl};z.Children={map:Rr,forEach:function(t,e,n){Rr(t,function(){e.apply(this,arguments)},n)},count:function(t){var e=0;return Rr(t,function(){e++}),e},toArray:function(t){return Rr(t,function(e){return e})||[]},only:function(t){if(!Wl(t))throw Error(vr(143));return t}};z.Component=Kn;z.PureComponent=Hl;z.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Kf;z.cloneElement=function(t,e,n){if(t==null)throw Error(vr(267,t));var i=Vl({},t.props),r=t.key,o=t.ref,s=t._owner;if(e!=null){if(e.ref!==void 0&&(o=e.ref,s=Ul.current),e.key!==void 0&&(r=""+e.key),t.type&&t.type.defaultProps)var l=t.type.defaultProps;for(a in e)dd.call(e,a)&&!hd.hasOwnProperty(a)&&(i[a]=e[a]===void 0&&l!==void 0?l[a]:e[a])}var a=arguments.length-2;if(a===1)i.children=n;else if(1<a){l=Array(a);for(var u=0;u<a;u++)l[u]=arguments[u+2];i.children=l}return{$$typeof:Jn,type:t.type,key:r,ref:o,props:i,_owner:s}};z.createContext=function(t,e){return e===void 0&&(e=null),t={$$typeof:rd,_calculateChangedBits:e,_currentValue:t,_currentValue2:t,_threadCount:0,Provider:null,Consumer:null},t.Provider={$$typeof:id,_context:t},t.Consumer=t};z.createElement=fd;z.createFactory=function(t){var e=fd.bind(null,t);return e.type=t,e};z.createRef=function(){return{current:null}};z.forwardRef=function(t){return{$$typeof:od,render:t}};z.isValidElement=Wl;z.lazy=function(t){return{$$typeof:ld,_payload:{_status:-1,_result:t},_init:Jf}};z.memo=function(t,e){return{$$typeof:sd,type:t,compare:e===void 0?null:e}};z.useCallback=function(t,e){return gt().useCallback(t,e)};z.useContext=function(t,e){return gt().useContext(t,e)};z.useDebugValue=function(){};z.useEffect=function(t,e){return gt().useEffect(t,e)};z.useImperativeHandle=function(t,e,n){return gt().useImperativeHandle(t,e,n)};z.useLayoutEffect=function(t,e){return gt().useLayoutEffect(t,e)};z.useMemo=function(t,e){return gt().useMemo(t,e)};z.useReducer=function(t,e,n){return gt().useReducer(t,e,n)};z.useRef=function(t){return gt().useRef(t)};z.useState=function(t){return gt().useState(t)};z.version="17.0.2";Bo.exports=z;var md=Bo.exports,gd={exports:{}},qe={},vd={exports:{}},yd={};/** @license React v0.20.2
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */(function(t){var e,n,i,r;if(typeof performance=="object"&&typeof performance.now=="function"){var o=performance;t.unstable_now=function(){return o.now()}}else{var s=Date,l=s.now();t.unstable_now=function(){return s.now()-l}}if(typeof window=="undefined"||typeof MessageChannel!="function"){var a=null,u=null,h=function(){if(a!==null)try{var S=t.unstable_now();a(!0,S),a=null}catch(_){throw setTimeout(h,0),_}};e=function(S){a!==null?setTimeout(e,0,S):(a=S,setTimeout(h,0))},n=function(S,_){u=setTimeout(S,_)},i=function(){clearTimeout(u)},t.unstable_shouldYield=function(){return!1},r=t.unstable_forceFrameRate=function(){}}else{var g=window.setTimeout,p=window.clearTimeout;if(typeof console!="undefined"){var w=window.cancelAnimationFrame;typeof window.requestAnimationFrame!="function"&&console.error("This browser doesn't support requestAnimationFrame. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills"),typeof w!="function"&&console.error("This browser doesn't support cancelAnimationFrame. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills")}var k=!1,$=null,f=-1,c=5,d=0;t.unstable_shouldYield=function(){return t.unstable_now()>=d},r=function(){},t.unstable_forceFrameRate=function(S){0>S||125<S?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):c=0<S?Math.floor(1e3/S):5};var v=new MessageChannel,y=v.port2;v.port1.onmessage=function(){if($!==null){var S=t.unstable_now();d=S+c;try{$(!0,S)?y.postMessage(null):(k=!1,$=null)}catch(_){throw y.postMessage(null),_}}else k=!1},e=function(S){$=S,k||(k=!0,y.postMessage(null))},n=function(S,_){f=g(function(){S(t.unstable_now())},_)},i=function(){p(f),f=-1}}function O(S,_){var N=S.length;S.push(_);e:for(;;){var K=N-1>>>1,ue=S[K];if(ue!==void 0&&0<L(ue,_))S[K]=_,S[N]=ue,N=K;else break e}}function C(S){return S=S[0],S===void 0?null:S}function P(S){var _=S[0];if(_!==void 0){var N=S.pop();if(N!==_){S[0]=N;e:for(var K=0,ue=S.length;K<ue;){var qt=2*(K+1)-1,Gt=S[qt],fi=qt+1,bn=S[fi];if(Gt!==void 0&&0>L(Gt,N))bn!==void 0&&0>L(bn,Gt)?(S[K]=bn,S[fi]=N,K=fi):(S[K]=Gt,S[qt]=N,K=qt);else if(bn!==void 0&&0>L(bn,N))S[K]=bn,S[fi]=N,K=fi;else break e}}return _}return null}function L(S,_){var N=S.sortIndex-_.sortIndex;return N!==0?N:S.id-_.id}var R=[],ae=[],ss=1,Me=null,fe=3,Or=!1,Qt=!1,hi=!1;function ls(S){for(var _=C(ae);_!==null;){if(_.callback===null)P(ae);else if(_.startTime<=S)P(ae),_.sortIndex=_.expirationTime,O(R,_);else break;_=C(ae)}}function as(S){if(hi=!1,ls(S),!Qt)if(C(R)!==null)Qt=!0,e(us);else{var _=C(ae);_!==null&&n(as,_.startTime-S)}}function us(S,_){Qt=!1,hi&&(hi=!1,i()),Or=!0;var N=fe;try{for(ls(_),Me=C(R);Me!==null&&(!(Me.expirationTime>_)||S&&!t.unstable_shouldYield());){var K=Me.callback;if(typeof K=="function"){Me.callback=null,fe=Me.priorityLevel;var ue=K(Me.expirationTime<=_);_=t.unstable_now(),typeof ue=="function"?Me.callback=ue:Me===C(R)&&P(R),ls(_)}else P(R);Me=C(R)}if(Me!==null)var qt=!0;else{var Gt=C(ae);Gt!==null&&n(as,Gt.startTime-_),qt=!1}return qt}finally{Me=null,fe=N,Or=!1}}var Vf=r;t.unstable_IdlePriority=5,t.unstable_ImmediatePriority=1,t.unstable_LowPriority=4,t.unstable_NormalPriority=3,t.unstable_Profiling=null,t.unstable_UserBlockingPriority=2,t.unstable_cancelCallback=function(S){S.callback=null},t.unstable_continueExecution=function(){Qt||Or||(Qt=!0,e(us))},t.unstable_getCurrentPriorityLevel=function(){return fe},t.unstable_getFirstCallbackNode=function(){return C(R)},t.unstable_next=function(S){switch(fe){case 1:case 2:case 3:var _=3;break;default:_=fe}var N=fe;fe=_;try{return S()}finally{fe=N}},t.unstable_pauseExecution=function(){},t.unstable_requestPaint=Vf,t.unstable_runWithPriority=function(S,_){switch(S){case 1:case 2:case 3:case 4:case 5:break;default:S=3}var N=fe;fe=S;try{return _()}finally{fe=N}},t.unstable_scheduleCallback=function(S,_,N){var K=t.unstable_now();switch(typeof N=="object"&&N!==null?(N=N.delay,N=typeof N=="number"&&0<N?K+N:K):N=K,S){case 1:var ue=-1;break;case 2:ue=250;break;case 5:ue=1073741823;break;case 4:ue=1e4;break;default:ue=5e3}return ue=N+ue,S={id:ss++,callback:_,priorityLevel:S,startTime:N,expirationTime:ue,sortIndex:-1},N>K?(S.sortIndex=N,O(ae,S),C(R)===null&&S===C(ae)&&(hi?i():hi=!0,n(as,N-K))):(S.sortIndex=ue,O(R,S),Qt||Or||(Qt=!0,e(us))),S},t.unstable_wrapCallback=function(S){var _=fe;return function(){var N=fe;fe=_;try{return S.apply(this,arguments)}finally{fe=N}}}})(yd);vd.exports=yd;/** @license React v17.0.2
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Mo=Bo.exports,Q=td,le=vd.exports;function x(t){for(var e="https://reactjs.org/docs/error-decoder.html?invariant="+t,n=1;n<arguments.length;n++)e+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+t+"; visit "+e+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}if(!Mo)throw Error(x(227));var bd=new Set,Ji={};function dn(t,e){Wn(t,e),Wn(t+"Capture",e)}function Wn(t,e){for(Ji[t]=e,t=0;t<e.length;t++)bd.add(e[t])}var mt=!(typeof window=="undefined"||typeof window.document=="undefined"||typeof window.document.createElement=="undefined"),ep=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,su=Object.prototype.hasOwnProperty,lu={},au={};function tp(t){return su.call(au,t)?!0:su.call(lu,t)?!1:ep.test(t)?au[t]=!0:(lu[t]=!0,!1)}function np(t,e,n,i){if(n!==null&&n.type===0)return!1;switch(typeof e){case"function":case"symbol":return!0;case"boolean":return i?!1:n!==null?!n.acceptsBooleans:(t=t.toLowerCase().slice(0,5),t!=="data-"&&t!=="aria-");default:return!1}}function ip(t,e,n,i){if(e===null||typeof e=="undefined"||np(t,e,n,i))return!0;if(i)return!1;if(n!==null)switch(n.type){case 3:return!e;case 4:return e===!1;case 5:return isNaN(e);case 6:return isNaN(e)||1>e}return!1}function Te(t,e,n,i,r,o,s){this.acceptsBooleans=e===2||e===3||e===4,this.attributeName=i,this.attributeNamespace=r,this.mustUseProperty=n,this.propertyName=t,this.type=e,this.sanitizeURL=o,this.removeEmptyString=s}var he={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(t){he[t]=new Te(t,0,!1,t,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(t){var e=t[0];he[e]=new Te(e,1,!1,t[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(t){he[t]=new Te(t,2,!1,t.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(t){he[t]=new Te(t,2,!1,t,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(t){he[t]=new Te(t,3,!1,t.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(t){he[t]=new Te(t,3,!0,t,null,!1,!1)});["capture","download"].forEach(function(t){he[t]=new Te(t,4,!1,t,null,!1,!1)});["cols","rows","size","span"].forEach(function(t){he[t]=new Te(t,6,!1,t,null,!1,!1)});["rowSpan","start"].forEach(function(t){he[t]=new Te(t,5,!1,t.toLowerCase(),null,!1,!1)});var Ql=/[\-:]([a-z])/g;function ql(t){return t[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t){var e=t.replace(Ql,ql);he[e]=new Te(e,1,!1,t,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t){var e=t.replace(Ql,ql);he[e]=new Te(e,1,!1,t,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(t){var e=t.replace(Ql,ql);he[e]=new Te(e,1,!1,t,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(t){he[t]=new Te(t,1,!1,t.toLowerCase(),null,!1,!1)});he.xlinkHref=new Te("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(t){he[t]=new Te(t,1,!1,t.toLowerCase(),null,!0,!0)});function Gl(t,e,n,i){var r=he.hasOwnProperty(e)?he[e]:null,o=r!==null?r.type===0:i?!1:!(!(2<e.length)||e[0]!=="o"&&e[0]!=="O"||e[1]!=="n"&&e[1]!=="N");o||(ip(e,n,r,i)&&(n=null),i||r===null?tp(e)&&(n===null?t.removeAttribute(e):t.setAttribute(e,""+n)):r.mustUseProperty?t[r.propertyName]=n===null?r.type===3?!1:"":n:(e=r.attributeName,i=r.attributeNamespace,n===null?t.removeAttribute(e):(r=r.type,n=r===3||r===4&&n===!0?"":""+n,i?t.setAttributeNS(i,e,n):t.setAttribute(e,n))))}var hn=Mo.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,Pi=60103,Jt=60106,xt=60107,Yl=60108,Ni=60114,Xl=60109,Zl=60110,zo=60112,Fi=60113,uo=60120,Vo=60115,Jl=60116,Kl=60121,ea=60128,wd=60129,ta=60130,Ys=60131;if(typeof Symbol=="function"&&Symbol.for){var oe=Symbol.for;Pi=oe("react.element"),Jt=oe("react.portal"),xt=oe("react.fragment"),Yl=oe("react.strict_mode"),Ni=oe("react.profiler"),Xl=oe("react.provider"),Zl=oe("react.context"),zo=oe("react.forward_ref"),Fi=oe("react.suspense"),uo=oe("react.suspense_list"),Vo=oe("react.memo"),Jl=oe("react.lazy"),Kl=oe("react.block"),oe("react.scope"),ea=oe("react.opaque.id"),wd=oe("react.debug_trace_mode"),ta=oe("react.offscreen"),Ys=oe("react.legacy_hidden")}var uu=typeof Symbol=="function"&&Symbol.iterator;function pi(t){return t===null||typeof t!="object"?null:(t=uu&&t[uu]||t["@@iterator"],typeof t=="function"?t:null)}var ds;function Di(t){if(ds===void 0)try{throw Error()}catch(n){var e=n.stack.trim().match(/\n( *(at )?)/);ds=e&&e[1]||""}return`
`+ds+t}var hs=!1;function Pr(t,e){if(!t||hs)return"";hs=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(e)if(e=function(){throw Error()},Object.defineProperty(e.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(e,[])}catch(a){var i=a}Reflect.construct(t,[],e)}else{try{e.call()}catch(a){i=a}t.call(e.prototype)}else{try{throw Error()}catch(a){i=a}t()}}catch(a){if(a&&i&&typeof a.stack=="string"){for(var r=a.stack.split(`
`),o=i.stack.split(`
`),s=r.length-1,l=o.length-1;1<=s&&0<=l&&r[s]!==o[l];)l--;for(;1<=s&&0<=l;s--,l--)if(r[s]!==o[l]){if(s!==1||l!==1)do if(s--,l--,0>l||r[s]!==o[l])return`
`+r[s].replace(" at new "," at ");while(1<=s&&0<=l);break}}}finally{hs=!1,Error.prepareStackTrace=n}return(t=t?t.displayName||t.name:"")?Di(t):""}function rp(t){switch(t.tag){case 5:return Di(t.type);case 16:return Di("Lazy");case 13:return Di("Suspense");case 19:return Di("SuspenseList");case 0:case 2:case 15:return t=Pr(t.type,!1),t;case 11:return t=Pr(t.type.render,!1),t;case 22:return t=Pr(t.type._render,!1),t;case 1:return t=Pr(t.type,!0),t;default:return""}}function Dn(t){if(t==null)return null;if(typeof t=="function")return t.displayName||t.name||null;if(typeof t=="string")return t;switch(t){case xt:return"Fragment";case Jt:return"Portal";case Ni:return"Profiler";case Yl:return"StrictMode";case Fi:return"Suspense";case uo:return"SuspenseList"}if(typeof t=="object")switch(t.$$typeof){case Zl:return(t.displayName||"Context")+".Consumer";case Xl:return(t._context.displayName||"Context")+".Provider";case zo:var e=t.render;return e=e.displayName||e.name||"",t.displayName||(e!==""?"ForwardRef("+e+")":"ForwardRef");case Vo:return Dn(t.type);case Kl:return Dn(t._render);case Jl:e=t._payload,t=t._init;try{return Dn(t(e))}catch{}}return null}function _t(t){switch(typeof t){case"boolean":case"number":case"object":case"string":case"undefined":return t;default:return""}}function xd(t){var e=t.type;return(t=t.nodeName)&&t.toLowerCase()==="input"&&(e==="checkbox"||e==="radio")}function op(t){var e=xd(t)?"checked":"value",n=Object.getOwnPropertyDescriptor(t.constructor.prototype,e),i=""+t[e];if(!t.hasOwnProperty(e)&&typeof n!="undefined"&&typeof n.get=="function"&&typeof n.set=="function"){var r=n.get,o=n.set;return Object.defineProperty(t,e,{configurable:!0,get:function(){return r.call(this)},set:function(s){i=""+s,o.call(this,s)}}),Object.defineProperty(t,e,{enumerable:n.enumerable}),{getValue:function(){return i},setValue:function(s){i=""+s},stopTracking:function(){t._valueTracker=null,delete t[e]}}}}function Dr(t){t._valueTracker||(t._valueTracker=op(t))}function kd(t){if(!t)return!1;var e=t._valueTracker;if(!e)return!0;var n=e.getValue(),i="";return t&&(i=xd(t)?t.checked?"true":"false":t.value),t=i,t!==n?(e.setValue(t),!0):!1}function co(t){if(t=t||(typeof document!="undefined"?document:void 0),typeof t=="undefined")return null;try{return t.activeElement||t.body}catch{return t.body}}function Xs(t,e){var n=e.checked;return Q({},e,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:n!=null?n:t._wrapperState.initialChecked})}function cu(t,e){var n=e.defaultValue==null?"":e.defaultValue,i=e.checked!=null?e.checked:e.defaultChecked;n=_t(e.value!=null?e.value:n),t._wrapperState={initialChecked:i,initialValue:n,controlled:e.type==="checkbox"||e.type==="radio"?e.checked!=null:e.value!=null}}function Cd(t,e){e=e.checked,e!=null&&Gl(t,"checked",e,!1)}function Zs(t,e){Cd(t,e);var n=_t(e.value),i=e.type;if(n!=null)i==="number"?(n===0&&t.value===""||t.value!=n)&&(t.value=""+n):t.value!==""+n&&(t.value=""+n);else if(i==="submit"||i==="reset"){t.removeAttribute("value");return}e.hasOwnProperty("value")?Js(t,e.type,n):e.hasOwnProperty("defaultValue")&&Js(t,e.type,_t(e.defaultValue)),e.checked==null&&e.defaultChecked!=null&&(t.defaultChecked=!!e.defaultChecked)}function du(t,e,n){if(e.hasOwnProperty("value")||e.hasOwnProperty("defaultValue")){var i=e.type;if(!(i!=="submit"&&i!=="reset"||e.value!==void 0&&e.value!==null))return;e=""+t._wrapperState.initialValue,n||e===t.value||(t.value=e),t.defaultValue=e}n=t.name,n!==""&&(t.name=""),t.defaultChecked=!!t._wrapperState.initialChecked,n!==""&&(t.name=n)}function Js(t,e,n){(e!=="number"||co(t.ownerDocument)!==t)&&(n==null?t.defaultValue=""+t._wrapperState.initialValue:t.defaultValue!==""+n&&(t.defaultValue=""+n))}function sp(t){var e="";return Mo.Children.forEach(t,function(n){n!=null&&(e+=n)}),e}function Ks(t,e){return t=Q({children:void 0},e),(e=sp(e.children))&&(t.children=e),t}function An(t,e,n,i){if(t=t.options,e){e={};for(var r=0;r<n.length;r++)e["$"+n[r]]=!0;for(n=0;n<t.length;n++)r=e.hasOwnProperty("$"+t[n].value),t[n].selected!==r&&(t[n].selected=r),r&&i&&(t[n].defaultSelected=!0)}else{for(n=""+_t(n),e=null,r=0;r<t.length;r++){if(t[r].value===n){t[r].selected=!0,i&&(t[r].defaultSelected=!0);return}e!==null||t[r].disabled||(e=t[r])}e!==null&&(e.selected=!0)}}function el(t,e){if(e.dangerouslySetInnerHTML!=null)throw Error(x(91));return Q({},e,{value:void 0,defaultValue:void 0,children:""+t._wrapperState.initialValue})}function hu(t,e){var n=e.value;if(n==null){if(n=e.children,e=e.defaultValue,n!=null){if(e!=null)throw Error(x(92));if(Array.isArray(n)){if(!(1>=n.length))throw Error(x(93));n=n[0]}e=n}e==null&&(e=""),n=e}t._wrapperState={initialValue:_t(n)}}function $d(t,e){var n=_t(e.value),i=_t(e.defaultValue);n!=null&&(n=""+n,n!==t.value&&(t.value=n),e.defaultValue==null&&t.defaultValue!==n&&(t.defaultValue=n)),i!=null&&(t.defaultValue=""+i)}function fu(t){var e=t.textContent;e===t._wrapperState.initialValue&&e!==""&&e!==null&&(t.value=e)}var tl={html:"http://www.w3.org/1999/xhtml",mathml:"http://www.w3.org/1998/Math/MathML",svg:"http://www.w3.org/2000/svg"};function Sd(t){switch(t){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function nl(t,e){return t==null||t==="http://www.w3.org/1999/xhtml"?Sd(e):t==="http://www.w3.org/2000/svg"&&e==="foreignObject"?"http://www.w3.org/1999/xhtml":t}var Ar,Ed=function(t){return typeof MSApp!="undefined"&&MSApp.execUnsafeLocalFunction?function(e,n,i,r){MSApp.execUnsafeLocalFunction(function(){return t(e,n,i,r)})}:t}(function(t,e){if(t.namespaceURI!==tl.svg||"innerHTML"in t)t.innerHTML=e;else{for(Ar=Ar||document.createElement("div"),Ar.innerHTML="<svg>"+e.valueOf().toString()+"</svg>",e=Ar.firstChild;t.firstChild;)t.removeChild(t.firstChild);for(;e.firstChild;)t.appendChild(e.firstChild)}});function Ki(t,e){if(e){var n=t.firstChild;if(n&&n===t.lastChild&&n.nodeType===3){n.nodeValue=e;return}}t.textContent=e}var Bi={animationIterationCount:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},lp=["Webkit","ms","Moz","O"];Object.keys(Bi).forEach(function(t){lp.forEach(function(e){e=e+t.charAt(0).toUpperCase()+t.substring(1),Bi[e]=Bi[t]})});function Td(t,e,n){return e==null||typeof e=="boolean"||e===""?"":n||typeof e!="number"||e===0||Bi.hasOwnProperty(t)&&Bi[t]?(""+e).trim():e+"px"}function Id(t,e){t=t.style;for(var n in e)if(e.hasOwnProperty(n)){var i=n.indexOf("--")===0,r=Td(n,e[n],i);n==="float"&&(n="cssFloat"),i?t.setProperty(n,r):t[n]=r}}var ap=Q({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function il(t,e){if(e){if(ap[t]&&(e.children!=null||e.dangerouslySetInnerHTML!=null))throw Error(x(137,t));if(e.dangerouslySetInnerHTML!=null){if(e.children!=null)throw Error(x(60));if(!(typeof e.dangerouslySetInnerHTML=="object"&&"__html"in e.dangerouslySetInnerHTML))throw Error(x(61))}if(e.style!=null&&typeof e.style!="object")throw Error(x(62))}}function rl(t,e){if(t.indexOf("-")===-1)return typeof e.is=="string";switch(t){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}function na(t){return t=t.target||t.srcElement||window,t.correspondingUseElement&&(t=t.correspondingUseElement),t.nodeType===3?t.parentNode:t}var ol=null,_n=null,Ln=null;function pu(t){if(t=br(t)){if(typeof ol!="function")throw Error(x(280));var e=t.stateNode;e&&(e=qo(e),ol(t.stateNode,t.type,e))}}function Od(t){_n?Ln?Ln.push(t):Ln=[t]:_n=t}function Rd(){if(_n){var t=_n,e=Ln;if(Ln=_n=null,pu(t),e)for(t=0;t<e.length;t++)pu(e[t])}}function ia(t,e){return t(e)}function Pd(t,e,n,i,r){return t(e,n,i,r)}function ra(){}var Dd=ia,Kt=!1,fs=!1;function oa(){(_n!==null||Ln!==null)&&(ra(),Rd())}function up(t,e,n){if(fs)return t(e,n);fs=!0;try{return Dd(t,e,n)}finally{fs=!1,oa()}}function er(t,e){var n=t.stateNode;if(n===null)return null;var i=qo(n);if(i===null)return null;n=i[e];e:switch(e){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(t=t.type,i=!(t==="button"||t==="input"||t==="select"||t==="textarea")),t=!i;break e;default:t=!1}if(t)return null;if(n&&typeof n!="function")throw Error(x(231,e,typeof n));return n}var sl=!1;if(mt)try{var mi={};Object.defineProperty(mi,"passive",{get:function(){sl=!0}}),window.addEventListener("test",mi,mi),window.removeEventListener("test",mi,mi)}catch{sl=!1}function cp(t,e,n,i,r,o,s,l,a){var u=Array.prototype.slice.call(arguments,3);try{e.apply(n,u)}catch(h){this.onError(h)}}var Mi=!1,ho=null,fo=!1,ll=null,dp={onError:function(t){Mi=!0,ho=t}};function hp(t,e,n,i,r,o,s,l,a){Mi=!1,ho=null,cp.apply(dp,arguments)}function fp(t,e,n,i,r,o,s,l,a){if(hp.apply(this,arguments),Mi){if(Mi){var u=ho;Mi=!1,ho=null}else throw Error(x(198));fo||(fo=!0,ll=u)}}function fn(t){var e=t,n=t;if(t.alternate)for(;e.return;)e=e.return;else{t=e;do e=t,(e.flags&1026)!==0&&(n=e.return),t=e.return;while(t)}return e.tag===3?n:null}function Ad(t){if(t.tag===13){var e=t.memoizedState;if(e===null&&(t=t.alternate,t!==null&&(e=t.memoizedState)),e!==null)return e.dehydrated}return null}function mu(t){if(fn(t)!==t)throw Error(x(188))}function pp(t){var e=t.alternate;if(!e){if(e=fn(t),e===null)throw Error(x(188));return e!==t?null:t}for(var n=t,i=e;;){var r=n.return;if(r===null)break;var o=r.alternate;if(o===null){if(i=r.return,i!==null){n=i;continue}break}if(r.child===o.child){for(o=r.child;o;){if(o===n)return mu(r),t;if(o===i)return mu(r),e;o=o.sibling}throw Error(x(188))}if(n.return!==i.return)n=r,i=o;else{for(var s=!1,l=r.child;l;){if(l===n){s=!0,n=r,i=o;break}if(l===i){s=!0,i=r,n=o;break}l=l.sibling}if(!s){for(l=o.child;l;){if(l===n){s=!0,n=o,i=r;break}if(l===i){s=!0,i=o,n=r;break}l=l.sibling}if(!s)throw Error(x(189))}}if(n.alternate!==i)throw Error(x(190))}if(n.tag!==3)throw Error(x(188));return n.stateNode.current===n?t:e}function _d(t){if(t=pp(t),!t)return null;for(var e=t;;){if(e.tag===5||e.tag===6)return e;if(e.child)e.child.return=e,e=e.child;else{if(e===t)break;for(;!e.sibling;){if(!e.return||e.return===t)return null;e=e.return}e.sibling.return=e.return,e=e.sibling}}return null}function gu(t,e){for(var n=t.alternate;e!==null;){if(e===t||e===n)return!0;e=e.return}return!1}var Ld,sa,Nd,Fd,al=!1,nt=[],St=null,Et=null,Tt=null,tr=new Map,nr=new Map,gi=[],vu="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function ul(t,e,n,i,r){return{blockedOn:t,domEventName:e,eventSystemFlags:n|16,nativeEvent:r,targetContainers:[i]}}function yu(t,e){switch(t){case"focusin":case"focusout":St=null;break;case"dragenter":case"dragleave":Et=null;break;case"mouseover":case"mouseout":Tt=null;break;case"pointerover":case"pointerout":tr.delete(e.pointerId);break;case"gotpointercapture":case"lostpointercapture":nr.delete(e.pointerId)}}function vi(t,e,n,i,r,o){return t===null||t.nativeEvent!==o?(t=ul(e,n,i,r,o),e!==null&&(e=br(e),e!==null&&sa(e)),t):(t.eventSystemFlags|=i,e=t.targetContainers,r!==null&&e.indexOf(r)===-1&&e.push(r),t)}function mp(t,e,n,i,r){switch(e){case"focusin":return St=vi(St,t,e,n,i,r),!0;case"dragenter":return Et=vi(Et,t,e,n,i,r),!0;case"mouseover":return Tt=vi(Tt,t,e,n,i,r),!0;case"pointerover":var o=r.pointerId;return tr.set(o,vi(tr.get(o)||null,t,e,n,i,r)),!0;case"gotpointercapture":return o=r.pointerId,nr.set(o,vi(nr.get(o)||null,t,e,n,i,r)),!0}return!1}function gp(t){var e=en(t.target);if(e!==null){var n=fn(e);if(n!==null){if(e=n.tag,e===13){if(e=Ad(n),e!==null){t.blockedOn=e,Fd(t.lanePriority,function(){le.unstable_runWithPriority(t.priority,function(){Nd(n)})});return}}else if(e===3&&n.stateNode.hydrate){t.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}t.blockedOn=null}function Xr(t){if(t.blockedOn!==null)return!1;for(var e=t.targetContainers;0<e.length;){var n=ca(t.domEventName,t.eventSystemFlags,e[0],t.nativeEvent);if(n!==null)return e=br(n),e!==null&&sa(e),t.blockedOn=n,!1;e.shift()}return!0}function bu(t,e,n){Xr(t)&&n.delete(e)}function vp(){for(al=!1;0<nt.length;){var t=nt[0];if(t.blockedOn!==null){t=br(t.blockedOn),t!==null&&Ld(t);break}for(var e=t.targetContainers;0<e.length;){var n=ca(t.domEventName,t.eventSystemFlags,e[0],t.nativeEvent);if(n!==null){t.blockedOn=n;break}e.shift()}t.blockedOn===null&&nt.shift()}St!==null&&Xr(St)&&(St=null),Et!==null&&Xr(Et)&&(Et=null),Tt!==null&&Xr(Tt)&&(Tt=null),tr.forEach(bu),nr.forEach(bu)}function yi(t,e){t.blockedOn===e&&(t.blockedOn=null,al||(al=!0,le.unstable_scheduleCallback(le.unstable_NormalPriority,vp)))}function Bd(t){function e(r){return yi(r,t)}if(0<nt.length){yi(nt[0],t);for(var n=1;n<nt.length;n++){var i=nt[n];i.blockedOn===t&&(i.blockedOn=null)}}for(St!==null&&yi(St,t),Et!==null&&yi(Et,t),Tt!==null&&yi(Tt,t),tr.forEach(e),nr.forEach(e),n=0;n<gi.length;n++)i=gi[n],i.blockedOn===t&&(i.blockedOn=null);for(;0<gi.length&&(n=gi[0],n.blockedOn===null);)gp(n),n.blockedOn===null&&gi.shift()}function _r(t,e){var n={};return n[t.toLowerCase()]=e.toLowerCase(),n["Webkit"+t]="webkit"+e,n["Moz"+t]="moz"+e,n}var $n={animationend:_r("Animation","AnimationEnd"),animationiteration:_r("Animation","AnimationIteration"),animationstart:_r("Animation","AnimationStart"),transitionend:_r("Transition","TransitionEnd")},ps={},Md={};mt&&(Md=document.createElement("div").style,"AnimationEvent"in window||(delete $n.animationend.animation,delete $n.animationiteration.animation,delete $n.animationstart.animation),"TransitionEvent"in window||delete $n.transitionend.transition);function Ho(t){if(ps[t])return ps[t];if(!$n[t])return t;var e=$n[t],n;for(n in e)if(e.hasOwnProperty(n)&&n in Md)return ps[t]=e[n];return t}var zd=Ho("animationend"),Vd=Ho("animationiteration"),Hd=Ho("animationstart"),jd=Ho("transitionend"),Ud=new Map,la=new Map,yp=["abort","abort",zd,"animationEnd",Vd,"animationIteration",Hd,"animationStart","canplay","canPlay","canplaythrough","canPlayThrough","durationchange","durationChange","emptied","emptied","encrypted","encrypted","ended","ended","error","error","gotpointercapture","gotPointerCapture","load","load","loadeddata","loadedData","loadedmetadata","loadedMetadata","loadstart","loadStart","lostpointercapture","lostPointerCapture","playing","playing","progress","progress","seeking","seeking","stalled","stalled","suspend","suspend","timeupdate","timeUpdate",jd,"transitionEnd","waiting","waiting"];function aa(t,e){for(var n=0;n<t.length;n+=2){var i=t[n],r=t[n+1];r="on"+(r[0].toUpperCase()+r.slice(1)),la.set(i,e),Ud.set(i,r),dn(r,[i])}}var bp=le.unstable_now;bp();var H=8;function xn(t){if((1&t)!==0)return H=15,1;if((2&t)!==0)return H=14,2;if((4&t)!==0)return H=13,4;var e=24&t;return e!==0?(H=12,e):(t&32)!==0?(H=11,32):(e=192&t,e!==0?(H=10,e):(t&256)!==0?(H=9,256):(e=3584&t,e!==0?(H=8,e):(t&4096)!==0?(H=7,4096):(e=4186112&t,e!==0?(H=6,e):(e=62914560&t,e!==0?(H=5,e):t&67108864?(H=4,67108864):(t&134217728)!==0?(H=3,134217728):(e=805306368&t,e!==0?(H=2,e):(1073741824&t)!==0?(H=1,1073741824):(H=8,t))))))}function wp(t){switch(t){case 99:return 15;case 98:return 10;case 97:case 96:return 8;case 95:return 2;default:return 0}}function xp(t){switch(t){case 15:case 14:return 99;case 13:case 12:case 11:case 10:return 98;case 9:case 8:case 7:case 6:case 4:case 5:return 97;case 3:case 2:case 1:return 95;case 0:return 90;default:throw Error(x(358,t))}}function ir(t,e){var n=t.pendingLanes;if(n===0)return H=0;var i=0,r=0,o=t.expiredLanes,s=t.suspendedLanes,l=t.pingedLanes;if(o!==0)i=o,r=H=15;else if(o=n&134217727,o!==0){var a=o&~s;a!==0?(i=xn(a),r=H):(l&=o,l!==0&&(i=xn(l),r=H))}else o=n&~s,o!==0?(i=xn(o),r=H):l!==0&&(i=xn(l),r=H);if(i===0)return 0;if(i=31-Lt(i),i=n&((0>i?0:1<<i)<<1)-1,e!==0&&e!==i&&(e&s)===0){if(xn(e),r<=H)return e;H=r}if(e=t.entangledLanes,e!==0)for(t=t.entanglements,e&=i;0<e;)n=31-Lt(e),r=1<<n,i|=t[n],e&=~r;return i}function Wd(t){return t=t.pendingLanes&-1073741825,t!==0?t:t&1073741824?1073741824:0}function po(t,e){switch(t){case 15:return 1;case 14:return 2;case 12:return t=kn(24&~e),t===0?po(10,e):t;case 10:return t=kn(192&~e),t===0?po(8,e):t;case 8:return t=kn(3584&~e),t===0&&(t=kn(4186112&~e),t===0&&(t=512)),t;case 2:return e=kn(805306368&~e),e===0&&(e=268435456),e}throw Error(x(358,t))}function kn(t){return t&-t}function ms(t){for(var e=[],n=0;31>n;n++)e.push(t);return e}function jo(t,e,n){t.pendingLanes|=e;var i=e-1;t.suspendedLanes&=i,t.pingedLanes&=i,t=t.eventTimes,e=31-Lt(e),t[e]=n}var Lt=Math.clz32?Math.clz32:$p,kp=Math.log,Cp=Math.LN2;function $p(t){return t===0?32:31-(kp(t)/Cp|0)|0}var Sp=le.unstable_UserBlockingPriority,Ep=le.unstable_runWithPriority,Zr=!0;function Tp(t,e,n,i){Kt||ra();var r=ua,o=Kt;Kt=!0;try{Pd(r,t,e,n,i)}finally{(Kt=o)||oa()}}function Ip(t,e,n,i){Ep(Sp,ua.bind(null,t,e,n,i))}function ua(t,e,n,i){if(Zr){var r;if((r=(e&4)===0)&&0<nt.length&&-1<vu.indexOf(t))t=ul(null,t,e,n,i),nt.push(t);else{var o=ca(t,e,n,i);if(o===null)r&&yu(t,i);else{if(r){if(-1<vu.indexOf(t)){t=ul(o,t,e,n,i),nt.push(t);return}if(mp(o,t,e,n,i))return;yu(t,i)}rh(t,e,i,null,n)}}}}function ca(t,e,n,i){var r=na(i);if(r=en(r),r!==null){var o=fn(r);if(o===null)r=null;else{var s=o.tag;if(s===13){if(r=Ad(o),r!==null)return r;r=null}else if(s===3){if(o.stateNode.hydrate)return o.tag===3?o.stateNode.containerInfo:null;r=null}else o!==r&&(r=null)}}return rh(t,e,i,r,n),null}var kt=null,da=null,Jr=null;function Qd(){if(Jr)return Jr;var t,e=da,n=e.length,i,r="value"in kt?kt.value:kt.textContent,o=r.length;for(t=0;t<n&&e[t]===r[t];t++);var s=n-t;for(i=1;i<=s&&e[n-i]===r[o-i];i++);return Jr=r.slice(t,1<i?1-i:void 0)}function Kr(t){var e=t.keyCode;return"charCode"in t?(t=t.charCode,t===0&&e===13&&(t=13)):t=e,t===10&&(t=13),32<=t||t===13?t:0}function Lr(){return!0}function wu(){return!1}function Fe(t){function e(n,i,r,o,s){this._reactName=n,this._targetInst=r,this.type=i,this.nativeEvent=o,this.target=s,this.currentTarget=null;for(var l in t)t.hasOwnProperty(l)&&(n=t[l],this[l]=n?n(o):o[l]);return this.isDefaultPrevented=(o.defaultPrevented!=null?o.defaultPrevented:o.returnValue===!1)?Lr:wu,this.isPropagationStopped=wu,this}return Q(e.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Lr)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Lr)},persist:function(){},isPersistent:Lr}),e}var ei={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(t){return t.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},ha=Fe(ei),yr=Q({},ei,{view:0,detail:0}),Op=Fe(yr),gs,vs,bi,Uo=Q({},yr,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:fa,button:0,buttons:0,relatedTarget:function(t){return t.relatedTarget===void 0?t.fromElement===t.srcElement?t.toElement:t.fromElement:t.relatedTarget},movementX:function(t){return"movementX"in t?t.movementX:(t!==bi&&(bi&&t.type==="mousemove"?(gs=t.screenX-bi.screenX,vs=t.screenY-bi.screenY):vs=gs=0,bi=t),gs)},movementY:function(t){return"movementY"in t?t.movementY:vs}}),xu=Fe(Uo),Rp=Q({},Uo,{dataTransfer:0}),Pp=Fe(Rp),Dp=Q({},yr,{relatedTarget:0}),ys=Fe(Dp),Ap=Q({},ei,{animationName:0,elapsedTime:0,pseudoElement:0}),_p=Fe(Ap),Lp=Q({},ei,{clipboardData:function(t){return"clipboardData"in t?t.clipboardData:window.clipboardData}}),Np=Fe(Lp),Fp=Q({},ei,{data:0}),ku=Fe(Fp),Bp={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Mp={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},zp={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Vp(t){var e=this.nativeEvent;return e.getModifierState?e.getModifierState(t):(t=zp[t])?!!e[t]:!1}function fa(){return Vp}var Hp=Q({},yr,{key:function(t){if(t.key){var e=Bp[t.key]||t.key;if(e!=="Unidentified")return e}return t.type==="keypress"?(t=Kr(t),t===13?"Enter":String.fromCharCode(t)):t.type==="keydown"||t.type==="keyup"?Mp[t.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:fa,charCode:function(t){return t.type==="keypress"?Kr(t):0},keyCode:function(t){return t.type==="keydown"||t.type==="keyup"?t.keyCode:0},which:function(t){return t.type==="keypress"?Kr(t):t.type==="keydown"||t.type==="keyup"?t.keyCode:0}}),jp=Fe(Hp),Up=Q({},Uo,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Cu=Fe(Up),Wp=Q({},yr,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:fa}),Qp=Fe(Wp),qp=Q({},ei,{propertyName:0,elapsedTime:0,pseudoElement:0}),Gp=Fe(qp),Yp=Q({},Uo,{deltaX:function(t){return"deltaX"in t?t.deltaX:"wheelDeltaX"in t?-t.wheelDeltaX:0},deltaY:function(t){return"deltaY"in t?t.deltaY:"wheelDeltaY"in t?-t.wheelDeltaY:"wheelDelta"in t?-t.wheelDelta:0},deltaZ:0,deltaMode:0}),Xp=Fe(Yp),Zp=[9,13,27,32],pa=mt&&"CompositionEvent"in window,zi=null;mt&&"documentMode"in document&&(zi=document.documentMode);var Jp=mt&&"TextEvent"in window&&!zi,qd=mt&&(!pa||zi&&8<zi&&11>=zi),$u=String.fromCharCode(32),Su=!1;function Gd(t,e){switch(t){case"keyup":return Zp.indexOf(e.keyCode)!==-1;case"keydown":return e.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Yd(t){return t=t.detail,typeof t=="object"&&"data"in t?t.data:null}var Sn=!1;function Kp(t,e){switch(t){case"compositionend":return Yd(e);case"keypress":return e.which!==32?null:(Su=!0,$u);case"textInput":return t=e.data,t===$u&&Su?null:t;default:return null}}function em(t,e){if(Sn)return t==="compositionend"||!pa&&Gd(t,e)?(t=Qd(),Jr=da=kt=null,Sn=!1,t):null;switch(t){case"paste":return null;case"keypress":if(!(e.ctrlKey||e.altKey||e.metaKey)||e.ctrlKey&&e.altKey){if(e.char&&1<e.char.length)return e.char;if(e.which)return String.fromCharCode(e.which)}return null;case"compositionend":return qd&&e.locale!=="ko"?null:e.data;default:return null}}var tm={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Eu(t){var e=t&&t.nodeName&&t.nodeName.toLowerCase();return e==="input"?!!tm[t.type]:e==="textarea"}function Xd(t,e,n,i){Od(i),e=mo(e,"onChange"),0<e.length&&(n=new ha("onChange","change",null,n,i),t.push({event:n,listeners:e}))}var Vi=null,rr=null;function nm(t){th(t,0)}function Wo(t){var e=Tn(t);if(kd(e))return t}function im(t,e){if(t==="change")return e}var Zd=!1;if(mt){var bs;if(mt){var ws="oninput"in document;if(!ws){var Tu=document.createElement("div");Tu.setAttribute("oninput","return;"),ws=typeof Tu.oninput=="function"}bs=ws}else bs=!1;Zd=bs&&(!document.documentMode||9<document.documentMode)}function Iu(){Vi&&(Vi.detachEvent("onpropertychange",Jd),rr=Vi=null)}function Jd(t){if(t.propertyName==="value"&&Wo(rr)){var e=[];if(Xd(e,rr,t,na(t)),t=nm,Kt)t(e);else{Kt=!0;try{ia(t,e)}finally{Kt=!1,oa()}}}}function rm(t,e,n){t==="focusin"?(Iu(),Vi=e,rr=n,Vi.attachEvent("onpropertychange",Jd)):t==="focusout"&&Iu()}function om(t){if(t==="selectionchange"||t==="keyup"||t==="keydown")return Wo(rr)}function sm(t,e){if(t==="click")return Wo(e)}function lm(t,e){if(t==="input"||t==="change")return Wo(e)}function am(t,e){return t===e&&(t!==0||1/t===1/e)||t!==t&&e!==e}var Ve=typeof Object.is=="function"?Object.is:am,um=Object.prototype.hasOwnProperty;function or(t,e){if(Ve(t,e))return!0;if(typeof t!="object"||t===null||typeof e!="object"||e===null)return!1;var n=Object.keys(t),i=Object.keys(e);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++)if(!um.call(e,n[i])||!Ve(t[n[i]],e[n[i]]))return!1;return!0}function Ou(t){for(;t&&t.firstChild;)t=t.firstChild;return t}function Ru(t,e){var n=Ou(t);t=0;for(var i;n;){if(n.nodeType===3){if(i=t+n.textContent.length,t<=e&&i>=e)return{node:n,offset:e-t};t=i}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=Ou(n)}}function Kd(t,e){return t&&e?t===e?!0:t&&t.nodeType===3?!1:e&&e.nodeType===3?Kd(t,e.parentNode):"contains"in t?t.contains(e):t.compareDocumentPosition?!!(t.compareDocumentPosition(e)&16):!1:!1}function Pu(){for(var t=window,e=co();e instanceof t.HTMLIFrameElement;){try{var n=typeof e.contentWindow.location.href=="string"}catch{n=!1}if(n)t=e.contentWindow;else break;e=co(t.document)}return e}function cl(t){var e=t&&t.nodeName&&t.nodeName.toLowerCase();return e&&(e==="input"&&(t.type==="text"||t.type==="search"||t.type==="tel"||t.type==="url"||t.type==="password")||e==="textarea"||t.contentEditable==="true")}var cm=mt&&"documentMode"in document&&11>=document.documentMode,En=null,dl=null,Hi=null,hl=!1;function Du(t,e,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;hl||En==null||En!==co(i)||(i=En,"selectionStart"in i&&cl(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Hi&&or(Hi,i)||(Hi=i,i=mo(dl,"onSelect"),0<i.length&&(e=new ha("onSelect","select",null,e,n),t.push({event:e,listeners:i}),e.target=En)))}aa("cancel cancel click click close close contextmenu contextMenu copy copy cut cut auxclick auxClick dblclick doubleClick dragend dragEnd dragstart dragStart drop drop focusin focus focusout blur input input invalid invalid keydown keyDown keypress keyPress keyup keyUp mousedown mouseDown mouseup mouseUp paste paste pause pause play play pointercancel pointerCancel pointerdown pointerDown pointerup pointerUp ratechange rateChange reset reset seeked seeked submit submit touchcancel touchCancel touchend touchEnd touchstart touchStart volumechange volumeChange".split(" "),0);aa("drag drag dragenter dragEnter dragexit dragExit dragleave dragLeave dragover dragOver mousemove mouseMove mouseout mouseOut mouseover mouseOver pointermove pointerMove pointerout pointerOut pointerover pointerOver scroll scroll toggle toggle touchmove touchMove wheel wheel".split(" "),1);aa(yp,2);for(var Au="change selectionchange textInput compositionstart compositionend compositionupdate".split(" "),xs=0;xs<Au.length;xs++)la.set(Au[xs],0);Wn("onMouseEnter",["mouseout","mouseover"]);Wn("onMouseLeave",["mouseout","mouseover"]);Wn("onPointerEnter",["pointerout","pointerover"]);Wn("onPointerLeave",["pointerout","pointerover"]);dn("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));dn("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));dn("onBeforeInput",["compositionend","keypress","textInput","paste"]);dn("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));dn("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));dn("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Ai="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),eh=new Set("cancel close invalid load scroll toggle".split(" ").concat(Ai));function _u(t,e,n){var i=t.type||"unknown-event";t.currentTarget=n,fp(i,e,void 0,t),t.currentTarget=null}function th(t,e){e=(e&4)!==0;for(var n=0;n<t.length;n++){var i=t[n],r=i.event;i=i.listeners;e:{var o=void 0;if(e)for(var s=i.length-1;0<=s;s--){var l=i[s],a=l.instance,u=l.currentTarget;if(l=l.listener,a!==o&&r.isPropagationStopped())break e;_u(r,l,u),o=a}else for(s=0;s<i.length;s++){if(l=i[s],a=l.instance,u=l.currentTarget,l=l.listener,a!==o&&r.isPropagationStopped())break e;_u(r,l,u),o=a}}}if(fo)throw t=ll,fo=!1,ll=null,t}function j(t,e){var n=sh(e),i=t+"__bubble";n.has(i)||(ih(e,t,2,!1),n.add(i))}var Lu="_reactListening"+Math.random().toString(36).slice(2);function nh(t){t[Lu]||(t[Lu]=!0,bd.forEach(function(e){eh.has(e)||Nu(e,!1,t,null),Nu(e,!0,t,null)}))}function Nu(t,e,n,i){var r=4<arguments.length&&arguments[4]!==void 0?arguments[4]:0,o=n;if(t==="selectionchange"&&n.nodeType!==9&&(o=n.ownerDocument),i!==null&&!e&&eh.has(t)){if(t!=="scroll")return;r|=2,o=i}var s=sh(o),l=t+"__"+(e?"capture":"bubble");s.has(l)||(e&&(r|=4),ih(o,t,r,e),s.add(l))}function ih(t,e,n,i){var r=la.get(e);switch(r===void 0?2:r){case 0:r=Tp;break;case 1:r=Ip;break;default:r=ua}n=r.bind(null,e,n,t),r=void 0,!sl||e!=="touchstart"&&e!=="touchmove"&&e!=="wheel"||(r=!0),i?r!==void 0?t.addEventListener(e,n,{capture:!0,passive:r}):t.addEventListener(e,n,!0):r!==void 0?t.addEventListener(e,n,{passive:r}):t.addEventListener(e,n,!1)}function rh(t,e,n,i,r){var o=i;if((e&1)===0&&(e&2)===0&&i!==null)e:for(;;){if(i===null)return;var s=i.tag;if(s===3||s===4){var l=i.stateNode.containerInfo;if(l===r||l.nodeType===8&&l.parentNode===r)break;if(s===4)for(s=i.return;s!==null;){var a=s.tag;if((a===3||a===4)&&(a=s.stateNode.containerInfo,a===r||a.nodeType===8&&a.parentNode===r))return;s=s.return}for(;l!==null;){if(s=en(l),s===null)return;if(a=s.tag,a===5||a===6){i=o=s;continue e}l=l.parentNode}}i=i.return}up(function(){var u=o,h=na(n),g=[];e:{var p=Ud.get(t);if(p!==void 0){var w=ha,k=t;switch(t){case"keypress":if(Kr(n)===0)break e;case"keydown":case"keyup":w=jp;break;case"focusin":k="focus",w=ys;break;case"focusout":k="blur",w=ys;break;case"beforeblur":case"afterblur":w=ys;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":w=xu;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":w=Pp;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":w=Qp;break;case zd:case Vd:case Hd:w=_p;break;case jd:w=Gp;break;case"scroll":w=Op;break;case"wheel":w=Xp;break;case"copy":case"cut":case"paste":w=Np;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":w=Cu}var $=(e&4)!==0,f=!$&&t==="scroll",c=$?p!==null?p+"Capture":null:p;$=[];for(var d=u,v;d!==null;){v=d;var y=v.stateNode;if(v.tag===5&&y!==null&&(v=y,c!==null&&(y=er(d,c),y!=null&&$.push(sr(d,y,v)))),f)break;d=d.return}0<$.length&&(p=new w(p,k,null,n,h),g.push({event:p,listeners:$}))}}if((e&7)===0){e:{if(p=t==="mouseover"||t==="pointerover",w=t==="mouseout"||t==="pointerout",p&&(e&16)===0&&(k=n.relatedTarget||n.fromElement)&&(en(k)||k[ti]))break e;if((w||p)&&(p=h.window===h?h:(p=h.ownerDocument)?p.defaultView||p.parentWindow:window,w?(k=n.relatedTarget||n.toElement,w=u,k=k?en(k):null,k!==null&&(f=fn(k),k!==f||k.tag!==5&&k.tag!==6)&&(k=null)):(w=null,k=u),w!==k)){if($=xu,y="onMouseLeave",c="onMouseEnter",d="mouse",(t==="pointerout"||t==="pointerover")&&($=Cu,y="onPointerLeave",c="onPointerEnter",d="pointer"),f=w==null?p:Tn(w),v=k==null?p:Tn(k),p=new $(y,d+"leave",w,n,h),p.target=f,p.relatedTarget=v,y=null,en(h)===u&&($=new $(c,d+"enter",k,n,h),$.target=v,$.relatedTarget=f,y=$),f=y,w&&k)t:{for($=w,c=k,d=0,v=$;v;v=wn(v))d++;for(v=0,y=c;y;y=wn(y))v++;for(;0<d-v;)$=wn($),d--;for(;0<v-d;)c=wn(c),v--;for(;d--;){if($===c||c!==null&&$===c.alternate)break t;$=wn($),c=wn(c)}$=null}else $=null;w!==null&&Fu(g,p,w,$,!1),k!==null&&f!==null&&Fu(g,f,k,$,!0)}}e:{if(p=u?Tn(u):window,w=p.nodeName&&p.nodeName.toLowerCase(),w==="select"||w==="input"&&p.type==="file")var O=im;else if(Eu(p))if(Zd)O=lm;else{O=om;var C=rm}else(w=p.nodeName)&&w.toLowerCase()==="input"&&(p.type==="checkbox"||p.type==="radio")&&(O=sm);if(O&&(O=O(t,u))){Xd(g,O,n,h);break e}C&&C(t,p,u),t==="focusout"&&(C=p._wrapperState)&&C.controlled&&p.type==="number"&&Js(p,"number",p.value)}switch(C=u?Tn(u):window,t){case"focusin":(Eu(C)||C.contentEditable==="true")&&(En=C,dl=u,Hi=null);break;case"focusout":Hi=dl=En=null;break;case"mousedown":hl=!0;break;case"contextmenu":case"mouseup":case"dragend":hl=!1,Du(g,n,h);break;case"selectionchange":if(cm)break;case"keydown":case"keyup":Du(g,n,h)}var P;if(pa)e:{switch(t){case"compositionstart":var L="onCompositionStart";break e;case"compositionend":L="onCompositionEnd";break e;case"compositionupdate":L="onCompositionUpdate";break e}L=void 0}else Sn?Gd(t,n)&&(L="onCompositionEnd"):t==="keydown"&&n.keyCode===229&&(L="onCompositionStart");L&&(qd&&n.locale!=="ko"&&(Sn||L!=="onCompositionStart"?L==="onCompositionEnd"&&Sn&&(P=Qd()):(kt=h,da="value"in kt?kt.value:kt.textContent,Sn=!0)),C=mo(u,L),0<C.length&&(L=new ku(L,t,null,n,h),g.push({event:L,listeners:C}),P?L.data=P:(P=Yd(n),P!==null&&(L.data=P)))),(P=Jp?Kp(t,n):em(t,n))&&(u=mo(u,"onBeforeInput"),0<u.length&&(h=new ku("onBeforeInput","beforeinput",null,n,h),g.push({event:h,listeners:u}),h.data=P))}th(g,e)})}function sr(t,e,n){return{instance:t,listener:e,currentTarget:n}}function mo(t,e){for(var n=e+"Capture",i=[];t!==null;){var r=t,o=r.stateNode;r.tag===5&&o!==null&&(r=o,o=er(t,n),o!=null&&i.unshift(sr(t,o,r)),o=er(t,e),o!=null&&i.push(sr(t,o,r))),t=t.return}return i}function wn(t){if(t===null)return null;do t=t.return;while(t&&t.tag!==5);return t||null}function Fu(t,e,n,i,r){for(var o=e._reactName,s=[];n!==null&&n!==i;){var l=n,a=l.alternate,u=l.stateNode;if(a!==null&&a===i)break;l.tag===5&&u!==null&&(l=u,r?(a=er(n,o),a!=null&&s.unshift(sr(n,a,l))):r||(a=er(n,o),a!=null&&s.push(sr(n,a,l)))),n=n.return}s.length!==0&&t.push({event:e,listeners:s})}function go(){}var ks=null,Cs=null;function oh(t,e){switch(t){case"button":case"input":case"select":case"textarea":return!!e.autoFocus}return!1}function fl(t,e){return t==="textarea"||t==="option"||t==="noscript"||typeof e.children=="string"||typeof e.children=="number"||typeof e.dangerouslySetInnerHTML=="object"&&e.dangerouslySetInnerHTML!==null&&e.dangerouslySetInnerHTML.__html!=null}var Bu=typeof setTimeout=="function"?setTimeout:void 0,dm=typeof clearTimeout=="function"?clearTimeout:void 0;function ma(t){t.nodeType===1?t.textContent="":t.nodeType===9&&(t=t.body,t!=null&&(t.textContent=""))}function Nn(t){for(;t!=null;t=t.nextSibling){var e=t.nodeType;if(e===1||e===3)break}return t}function Mu(t){t=t.previousSibling;for(var e=0;t;){if(t.nodeType===8){var n=t.data;if(n==="$"||n==="$!"||n==="$?"){if(e===0)return t;e--}else n==="/$"&&e++}t=t.previousSibling}return null}var $s=0;function hm(t){return{$$typeof:ea,toString:t,valueOf:t}}var Qo=Math.random().toString(36).slice(2),Ct="__reactFiber$"+Qo,vo="__reactProps$"+Qo,ti="__reactContainer$"+Qo,zu="__reactEvents$"+Qo;function en(t){var e=t[Ct];if(e)return e;for(var n=t.parentNode;n;){if(e=n[ti]||n[Ct]){if(n=e.alternate,e.child!==null||n!==null&&n.child!==null)for(t=Mu(t);t!==null;){if(n=t[Ct])return n;t=Mu(t)}return e}t=n,n=t.parentNode}return null}function br(t){return t=t[Ct]||t[ti],!t||t.tag!==5&&t.tag!==6&&t.tag!==13&&t.tag!==3?null:t}function Tn(t){if(t.tag===5||t.tag===6)return t.stateNode;throw Error(x(33))}function qo(t){return t[vo]||null}function sh(t){var e=t[zu];return e===void 0&&(e=t[zu]=new Set),e}var pl=[],In=-1;function Vt(t){return{current:t}}function U(t){0>In||(t.current=pl[In],pl[In]=null,In--)}function J(t,e){In++,pl[In]=t.current,t.current=e}var Nt={},ye=Vt(Nt),Pe=Vt(!1),ln=Nt;function Qn(t,e){var n=t.type.contextTypes;if(!n)return Nt;var i=t.stateNode;if(i&&i.__reactInternalMemoizedUnmaskedChildContext===e)return i.__reactInternalMemoizedMaskedChildContext;var r={},o;for(o in n)r[o]=e[o];return i&&(t=t.stateNode,t.__reactInternalMemoizedUnmaskedChildContext=e,t.__reactInternalMemoizedMaskedChildContext=r),r}function De(t){return t=t.childContextTypes,t!=null}function yo(){U(Pe),U(ye)}function Vu(t,e,n){if(ye.current!==Nt)throw Error(x(168));J(ye,e),J(Pe,n)}function lh(t,e,n){var i=t.stateNode;if(t=e.childContextTypes,typeof i.getChildContext!="function")return n;i=i.getChildContext();for(var r in i)if(!(r in t))throw Error(x(108,Dn(e)||"Unknown",r));return Q({},n,i)}function eo(t){return t=(t=t.stateNode)&&t.__reactInternalMemoizedMergedChildContext||Nt,ln=ye.current,J(ye,t),J(Pe,Pe.current),!0}function Hu(t,e,n){var i=t.stateNode;if(!i)throw Error(x(169));n?(t=lh(t,e,ln),i.__reactInternalMemoizedMergedChildContext=t,U(Pe),U(ye),J(ye,t)):U(Pe),J(Pe,n)}var ga=null,on=null,fm=le.unstable_runWithPriority,va=le.unstable_scheduleCallback,ml=le.unstable_cancelCallback,pm=le.unstable_shouldYield,ju=le.unstable_requestPaint,gl=le.unstable_now,mm=le.unstable_getCurrentPriorityLevel,Go=le.unstable_ImmediatePriority,ah=le.unstable_UserBlockingPriority,uh=le.unstable_NormalPriority,ch=le.unstable_LowPriority,dh=le.unstable_IdlePriority,Ss={},gm=ju!==void 0?ju:function(){},at=null,to=null,Es=!1,Uu=gl(),me=1e4>Uu?gl:function(){return gl()-Uu};function qn(){switch(mm()){case Go:return 99;case ah:return 98;case uh:return 97;case ch:return 96;case dh:return 95;default:throw Error(x(332))}}function hh(t){switch(t){case 99:return Go;case 98:return ah;case 97:return uh;case 96:return ch;case 95:return dh;default:throw Error(x(332))}}function an(t,e){return t=hh(t),fm(t,e)}function lr(t,e,n){return t=hh(t),va(t,e,n)}function lt(){if(to!==null){var t=to;to=null,ml(t)}fh()}function fh(){if(!Es&&at!==null){Es=!0;var t=0;try{var e=at;an(99,function(){for(;t<e.length;t++){var n=e[t];do n=n(!0);while(n!==null)}}),at=null}catch(n){throw at!==null&&(at=at.slice(t+1)),va(Go,lt),n}finally{Es=!1}}}var vm=hn.ReactCurrentBatchConfig;function Xe(t,e){if(t&&t.defaultProps){e=Q({},e),t=t.defaultProps;for(var n in t)e[n]===void 0&&(e[n]=t[n]);return e}return e}var bo=Vt(null),wo=null,On=null,xo=null;function ya(){xo=On=wo=null}function ba(t){var e=bo.current;U(bo),t.type._context._currentValue=e}function ph(t,e){for(;t!==null;){var n=t.alternate;if((t.childLanes&e)===e){if(n===null||(n.childLanes&e)===e)break;n.childLanes|=e}else t.childLanes|=e,n!==null&&(n.childLanes|=e);t=t.return}}function Fn(t,e){wo=t,xo=On=null,t=t.dependencies,t!==null&&t.firstContext!==null&&((t.lanes&e)!==0&&(Je=!0),t.firstContext=null)}function Ue(t,e){if(xo!==t&&e!==!1&&e!==0)if((typeof e!="number"||e===1073741823)&&(xo=t,e=1073741823),e={context:t,observedBits:e,next:null},On===null){if(wo===null)throw Error(x(308));On=e,wo.dependencies={lanes:0,firstContext:e,responders:null}}else On=On.next=e;return t._currentValue}var wt=!1;function wa(t){t.updateQueue={baseState:t.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null},effects:null}}function mh(t,e){t=t.updateQueue,e.updateQueue===t&&(e.updateQueue={baseState:t.baseState,firstBaseUpdate:t.firstBaseUpdate,lastBaseUpdate:t.lastBaseUpdate,shared:t.shared,effects:t.effects})}function It(t,e){return{eventTime:t,lane:e,tag:0,payload:null,callback:null,next:null}}function Ot(t,e){if(t=t.updateQueue,t!==null){t=t.shared;var n=t.pending;n===null?e.next=e:(e.next=n.next,n.next=e),t.pending=e}}function Wu(t,e){var n=t.updateQueue,i=t.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var r=null,o=null;if(n=n.firstBaseUpdate,n!==null){do{var s={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};o===null?r=o=s:o=o.next=s,n=n.next}while(n!==null);o===null?r=o=e:o=o.next=e}else r=o=e;n={baseState:i.baseState,firstBaseUpdate:r,lastBaseUpdate:o,shared:i.shared,effects:i.effects},t.updateQueue=n;return}t=n.lastBaseUpdate,t===null?n.firstBaseUpdate=e:t.next=e,n.lastBaseUpdate=e}function ar(t,e,n,i){var r=t.updateQueue;wt=!1;var o=r.firstBaseUpdate,s=r.lastBaseUpdate,l=r.shared.pending;if(l!==null){r.shared.pending=null;var a=l,u=a.next;a.next=null,s===null?o=u:s.next=u,s=a;var h=t.alternate;if(h!==null){h=h.updateQueue;var g=h.lastBaseUpdate;g!==s&&(g===null?h.firstBaseUpdate=u:g.next=u,h.lastBaseUpdate=a)}}if(o!==null){g=r.baseState,s=0,h=u=a=null;do{l=o.lane;var p=o.eventTime;if((i&l)===l){h!==null&&(h=h.next={eventTime:p,lane:0,tag:o.tag,payload:o.payload,callback:o.callback,next:null});e:{var w=t,k=o;switch(l=e,p=n,k.tag){case 1:if(w=k.payload,typeof w=="function"){g=w.call(p,g,l);break e}g=w;break e;case 3:w.flags=w.flags&-4097|64;case 0:if(w=k.payload,l=typeof w=="function"?w.call(p,g,l):w,l==null)break e;g=Q({},g,l);break e;case 2:wt=!0}}o.callback!==null&&(t.flags|=32,l=r.effects,l===null?r.effects=[o]:l.push(o))}else p={eventTime:p,lane:l,tag:o.tag,payload:o.payload,callback:o.callback,next:null},h===null?(u=h=p,a=g):h=h.next=p,s|=l;if(o=o.next,o===null){if(l=r.shared.pending,l===null)break;o=l.next,l.next=null,r.lastBaseUpdate=l,r.shared.pending=null}}while(1);h===null&&(a=g),r.baseState=a,r.firstBaseUpdate=u,r.lastBaseUpdate=h,xr|=s,t.lanes=s,t.memoizedState=g}}function Qu(t,e,n){if(t=e.effects,e.effects=null,t!==null)for(e=0;e<t.length;e++){var i=t[e],r=i.callback;if(r!==null){if(i.callback=null,i=n,typeof r!="function")throw Error(x(191,r));r.call(i)}}}var gh=new Mo.Component().refs;function ko(t,e,n,i){e=t.memoizedState,n=n(i,e),n=n==null?e:Q({},e,n),t.memoizedState=n,t.lanes===0&&(t.updateQueue.baseState=n)}var Yo={isMounted:function(t){return(t=t._reactInternals)?fn(t)===t:!1},enqueueSetState:function(t,e,n){t=t._reactInternals;var i=Ne(),r=Rt(t),o=It(i,r);o.payload=e,n!=null&&(o.callback=n),Ot(t,o),Pt(t,r,i)},enqueueReplaceState:function(t,e,n){t=t._reactInternals;var i=Ne(),r=Rt(t),o=It(i,r);o.tag=1,o.payload=e,n!=null&&(o.callback=n),Ot(t,o),Pt(t,r,i)},enqueueForceUpdate:function(t,e){t=t._reactInternals;var n=Ne(),i=Rt(t),r=It(n,i);r.tag=2,e!=null&&(r.callback=e),Ot(t,r),Pt(t,i,n)}};function qu(t,e,n,i,r,o,s){return t=t.stateNode,typeof t.shouldComponentUpdate=="function"?t.shouldComponentUpdate(i,o,s):e.prototype&&e.prototype.isPureReactComponent?!or(n,i)||!or(r,o):!0}function vh(t,e,n){var i=!1,r=Nt,o=e.contextType;return typeof o=="object"&&o!==null?o=Ue(o):(r=De(e)?ln:ye.current,i=e.contextTypes,o=(i=i!=null)?Qn(t,r):Nt),e=new e(n,o),t.memoizedState=e.state!==null&&e.state!==void 0?e.state:null,e.updater=Yo,t.stateNode=e,e._reactInternals=t,i&&(t=t.stateNode,t.__reactInternalMemoizedUnmaskedChildContext=r,t.__reactInternalMemoizedMaskedChildContext=o),e}function Gu(t,e,n,i){t=e.state,typeof e.componentWillReceiveProps=="function"&&e.componentWillReceiveProps(n,i),typeof e.UNSAFE_componentWillReceiveProps=="function"&&e.UNSAFE_componentWillReceiveProps(n,i),e.state!==t&&Yo.enqueueReplaceState(e,e.state,null)}function vl(t,e,n,i){var r=t.stateNode;r.props=n,r.state=t.memoizedState,r.refs=gh,wa(t);var o=e.contextType;typeof o=="object"&&o!==null?r.context=Ue(o):(o=De(e)?ln:ye.current,r.context=Qn(t,o)),ar(t,n,r,i),r.state=t.memoizedState,o=e.getDerivedStateFromProps,typeof o=="function"&&(ko(t,e,o,n),r.state=t.memoizedState),typeof e.getDerivedStateFromProps=="function"||typeof r.getSnapshotBeforeUpdate=="function"||typeof r.UNSAFE_componentWillMount!="function"&&typeof r.componentWillMount!="function"||(e=r.state,typeof r.componentWillMount=="function"&&r.componentWillMount(),typeof r.UNSAFE_componentWillMount=="function"&&r.UNSAFE_componentWillMount(),e!==r.state&&Yo.enqueueReplaceState(r,r.state,null),ar(t,n,r,i),r.state=t.memoizedState),typeof r.componentDidMount=="function"&&(t.flags|=4)}var Nr=Array.isArray;function wi(t,e,n){if(t=n.ref,t!==null&&typeof t!="function"&&typeof t!="object"){if(n._owner){if(n=n._owner,n){if(n.tag!==1)throw Error(x(309));var i=n.stateNode}if(!i)throw Error(x(147,t));var r=""+t;return e!==null&&e.ref!==null&&typeof e.ref=="function"&&e.ref._stringRef===r?e.ref:(e=function(o){var s=i.refs;s===gh&&(s=i.refs={}),o===null?delete s[r]:s[r]=o},e._stringRef=r,e)}if(typeof t!="string")throw Error(x(284));if(!n._owner)throw Error(x(290,t))}return t}function Fr(t,e){if(t.type!=="textarea")throw Error(x(31,Object.prototype.toString.call(e)==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":e))}function yh(t){function e(f,c){if(t){var d=f.lastEffect;d!==null?(d.nextEffect=c,f.lastEffect=c):f.firstEffect=f.lastEffect=c,c.nextEffect=null,c.flags=8}}function n(f,c){if(!t)return null;for(;c!==null;)e(f,c),c=c.sibling;return null}function i(f,c){for(f=new Map;c!==null;)c.key!==null?f.set(c.key,c):f.set(c.index,c),c=c.sibling;return f}function r(f,c){return f=Bt(f,c),f.index=0,f.sibling=null,f}function o(f,c,d){return f.index=d,t?(d=f.alternate,d!==null?(d=d.index,d<c?(f.flags=2,c):d):(f.flags=2,c)):c}function s(f){return t&&f.alternate===null&&(f.flags=2),f}function l(f,c,d,v){return c===null||c.tag!==6?(c=Ps(d,f.mode,v),c.return=f,c):(c=r(c,d),c.return=f,c)}function a(f,c,d,v){return c!==null&&c.elementType===d.type?(v=r(c,d.props),v.ref=wi(f,c,d),v.return=f,v):(v=oo(d.type,d.key,d.props,null,f.mode,v),v.ref=wi(f,c,d),v.return=f,v)}function u(f,c,d,v){return c===null||c.tag!==4||c.stateNode.containerInfo!==d.containerInfo||c.stateNode.implementation!==d.implementation?(c=Ds(d,f.mode,v),c.return=f,c):(c=r(c,d.children||[]),c.return=f,c)}function h(f,c,d,v,y){return c===null||c.tag!==7?(c=Vn(d,f.mode,v,y),c.return=f,c):(c=r(c,d),c.return=f,c)}function g(f,c,d){if(typeof c=="string"||typeof c=="number")return c=Ps(""+c,f.mode,d),c.return=f,c;if(typeof c=="object"&&c!==null){switch(c.$$typeof){case Pi:return d=oo(c.type,c.key,c.props,null,f.mode,d),d.ref=wi(f,null,c),d.return=f,d;case Jt:return c=Ds(c,f.mode,d),c.return=f,c}if(Nr(c)||pi(c))return c=Vn(c,f.mode,d,null),c.return=f,c;Fr(f,c)}return null}function p(f,c,d,v){var y=c!==null?c.key:null;if(typeof d=="string"||typeof d=="number")return y!==null?null:l(f,c,""+d,v);if(typeof d=="object"&&d!==null){switch(d.$$typeof){case Pi:return d.key===y?d.type===xt?h(f,c,d.props.children,v,y):a(f,c,d,v):null;case Jt:return d.key===y?u(f,c,d,v):null}if(Nr(d)||pi(d))return y!==null?null:h(f,c,d,v,null);Fr(f,d)}return null}function w(f,c,d,v,y){if(typeof v=="string"||typeof v=="number")return f=f.get(d)||null,l(c,f,""+v,y);if(typeof v=="object"&&v!==null){switch(v.$$typeof){case Pi:return f=f.get(v.key===null?d:v.key)||null,v.type===xt?h(c,f,v.props.children,y,v.key):a(c,f,v,y);case Jt:return f=f.get(v.key===null?d:v.key)||null,u(c,f,v,y)}if(Nr(v)||pi(v))return f=f.get(d)||null,h(c,f,v,y,null);Fr(c,v)}return null}function k(f,c,d,v){for(var y=null,O=null,C=c,P=c=0,L=null;C!==null&&P<d.length;P++){C.index>P?(L=C,C=null):L=C.sibling;var R=p(f,C,d[P],v);if(R===null){C===null&&(C=L);break}t&&C&&R.alternate===null&&e(f,C),c=o(R,c,P),O===null?y=R:O.sibling=R,O=R,C=L}if(P===d.length)return n(f,C),y;if(C===null){for(;P<d.length;P++)C=g(f,d[P],v),C!==null&&(c=o(C,c,P),O===null?y=C:O.sibling=C,O=C);return y}for(C=i(f,C);P<d.length;P++)L=w(C,f,P,d[P],v),L!==null&&(t&&L.alternate!==null&&C.delete(L.key===null?P:L.key),c=o(L,c,P),O===null?y=L:O.sibling=L,O=L);return t&&C.forEach(function(ae){return e(f,ae)}),y}function $(f,c,d,v){var y=pi(d);if(typeof y!="function")throw Error(x(150));if(d=y.call(d),d==null)throw Error(x(151));for(var O=y=null,C=c,P=c=0,L=null,R=d.next();C!==null&&!R.done;P++,R=d.next()){C.index>P?(L=C,C=null):L=C.sibling;var ae=p(f,C,R.value,v);if(ae===null){C===null&&(C=L);break}t&&C&&ae.alternate===null&&e(f,C),c=o(ae,c,P),O===null?y=ae:O.sibling=ae,O=ae,C=L}if(R.done)return n(f,C),y;if(C===null){for(;!R.done;P++,R=d.next())R=g(f,R.value,v),R!==null&&(c=o(R,c,P),O===null?y=R:O.sibling=R,O=R);return y}for(C=i(f,C);!R.done;P++,R=d.next())R=w(C,f,P,R.value,v),R!==null&&(t&&R.alternate!==null&&C.delete(R.key===null?P:R.key),c=o(R,c,P),O===null?y=R:O.sibling=R,O=R);return t&&C.forEach(function(ss){return e(f,ss)}),y}return function(f,c,d,v){var y=typeof d=="object"&&d!==null&&d.type===xt&&d.key===null;y&&(d=d.props.children);var O=typeof d=="object"&&d!==null;if(O)switch(d.$$typeof){case Pi:e:{for(O=d.key,y=c;y!==null;){if(y.key===O){switch(y.tag){case 7:if(d.type===xt){n(f,y.sibling),c=r(y,d.props.children),c.return=f,f=c;break e}break;default:if(y.elementType===d.type){n(f,y.sibling),c=r(y,d.props),c.ref=wi(f,y,d),c.return=f,f=c;break e}}n(f,y);break}else e(f,y);y=y.sibling}d.type===xt?(c=Vn(d.props.children,f.mode,v,d.key),c.return=f,f=c):(v=oo(d.type,d.key,d.props,null,f.mode,v),v.ref=wi(f,c,d),v.return=f,f=v)}return s(f);case Jt:e:{for(y=d.key;c!==null;){if(c.key===y)if(c.tag===4&&c.stateNode.containerInfo===d.containerInfo&&c.stateNode.implementation===d.implementation){n(f,c.sibling),c=r(c,d.children||[]),c.return=f,f=c;break e}else{n(f,c);break}else e(f,c);c=c.sibling}c=Ds(d,f.mode,v),c.return=f,f=c}return s(f)}if(typeof d=="string"||typeof d=="number")return d=""+d,c!==null&&c.tag===6?(n(f,c.sibling),c=r(c,d),c.return=f,f=c):(n(f,c),c=Ps(d,f.mode,v),c.return=f,f=c),s(f);if(Nr(d))return k(f,c,d,v);if(pi(d))return $(f,c,d,v);if(O&&Fr(f,d),typeof d=="undefined"&&!y)switch(f.tag){case 1:case 22:case 0:case 11:case 15:throw Error(x(152,Dn(f.type)||"Component"))}return n(f,c)}}var Co=yh(!0),bh=yh(!1),wr={},ot=Vt(wr),ur=Vt(wr),cr=Vt(wr);function tn(t){if(t===wr)throw Error(x(174));return t}function yl(t,e){switch(J(cr,e),J(ur,t),J(ot,wr),t=e.nodeType,t){case 9:case 11:e=(e=e.documentElement)?e.namespaceURI:nl(null,"");break;default:t=t===8?e.parentNode:e,e=t.namespaceURI||null,t=t.tagName,e=nl(e,t)}U(ot),J(ot,e)}function Gn(){U(ot),U(ur),U(cr)}function Yu(t){tn(cr.current);var e=tn(ot.current),n=nl(e,t.type);e!==n&&(J(ur,t),J(ot,n))}function xa(t){ur.current===t&&(U(ot),U(ur))}var Z=Vt(0);function $o(t){for(var e=t;e!==null;){if(e.tag===13){var n=e.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||n.data==="$?"||n.data==="$!"))return e}else if(e.tag===19&&e.memoizedProps.revealOrder!==void 0){if((e.flags&64)!==0)return e}else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break;for(;e.sibling===null;){if(e.return===null||e.return===t)return null;e=e.return}e.sibling.return=e.return,e=e.sibling}return null}var dt=null,$t=null,st=!1;function wh(t,e){var n=He(5,null,null,0);n.elementType="DELETED",n.type="DELETED",n.stateNode=e,n.return=t,n.flags=8,t.lastEffect!==null?(t.lastEffect.nextEffect=n,t.lastEffect=n):t.firstEffect=t.lastEffect=n}function Xu(t,e){switch(t.tag){case 5:var n=t.type;return e=e.nodeType!==1||n.toLowerCase()!==e.nodeName.toLowerCase()?null:e,e!==null?(t.stateNode=e,!0):!1;case 6:return e=t.pendingProps===""||e.nodeType!==3?null:e,e!==null?(t.stateNode=e,!0):!1;case 13:return!1;default:return!1}}function bl(t){if(st){var e=$t;if(e){var n=e;if(!Xu(t,e)){if(e=Nn(n.nextSibling),!e||!Xu(t,e)){t.flags=t.flags&-1025|2,st=!1,dt=t;return}wh(dt,n)}dt=t,$t=Nn(e.firstChild)}else t.flags=t.flags&-1025|2,st=!1,dt=t}}function Zu(t){for(t=t.return;t!==null&&t.tag!==5&&t.tag!==3&&t.tag!==13;)t=t.return;dt=t}function Br(t){if(t!==dt)return!1;if(!st)return Zu(t),st=!0,!1;var e=t.type;if(t.tag!==5||e!=="head"&&e!=="body"&&!fl(e,t.memoizedProps))for(e=$t;e;)wh(t,e),e=Nn(e.nextSibling);if(Zu(t),t.tag===13){if(t=t.memoizedState,t=t!==null?t.dehydrated:null,!t)throw Error(x(317));e:{for(t=t.nextSibling,e=0;t;){if(t.nodeType===8){var n=t.data;if(n==="/$"){if(e===0){$t=Nn(t.nextSibling);break e}e--}else n!=="$"&&n!=="$!"&&n!=="$?"||e++}t=t.nextSibling}$t=null}}else $t=dt?Nn(t.stateNode.nextSibling):null;return!0}function Ts(){$t=dt=null,st=!1}var Bn=[];function ka(){for(var t=0;t<Bn.length;t++)Bn[t]._workInProgressVersionPrimary=null;Bn.length=0}var ji=hn.ReactCurrentDispatcher,je=hn.ReactCurrentBatchConfig,dr=0,te=null,pe=null,ce=null,So=!1,Ui=!1;function Oe(){throw Error(x(321))}function Ca(t,e){if(e===null)return!1;for(var n=0;n<e.length&&n<t.length;n++)if(!Ve(t[n],e[n]))return!1;return!0}function $a(t,e,n,i,r,o){if(dr=o,te=e,e.memoizedState=null,e.updateQueue=null,e.lanes=0,ji.current=t===null||t.memoizedState===null?bm:wm,t=n(i,r),Ui){o=0;do{if(Ui=!1,!(25>o))throw Error(x(301));o+=1,ce=pe=null,e.updateQueue=null,ji.current=xm,t=n(i,r)}while(Ui)}if(ji.current=Oo,e=pe!==null&&pe.next!==null,dr=0,ce=pe=te=null,So=!1,e)throw Error(x(300));return t}function nn(){var t={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return ce===null?te.memoizedState=ce=t:ce=ce.next=t,ce}function pn(){if(pe===null){var t=te.alternate;t=t!==null?t.memoizedState:null}else t=pe.next;var e=ce===null?te.memoizedState:ce.next;if(e!==null)ce=e,pe=t;else{if(t===null)throw Error(x(310));pe=t,t={memoizedState:pe.memoizedState,baseState:pe.baseState,baseQueue:pe.baseQueue,queue:pe.queue,next:null},ce===null?te.memoizedState=ce=t:ce=ce.next=t}return ce}function it(t,e){return typeof e=="function"?e(t):e}function xi(t){var e=pn(),n=e.queue;if(n===null)throw Error(x(311));n.lastRenderedReducer=t;var i=pe,r=i.baseQueue,o=n.pending;if(o!==null){if(r!==null){var s=r.next;r.next=o.next,o.next=s}i.baseQueue=r=o,n.pending=null}if(r!==null){r=r.next,i=i.baseState;var l=s=o=null,a=r;do{var u=a.lane;if((dr&u)===u)l!==null&&(l=l.next={lane:0,action:a.action,eagerReducer:a.eagerReducer,eagerState:a.eagerState,next:null}),i=a.eagerReducer===t?a.eagerState:t(i,a.action);else{var h={lane:u,action:a.action,eagerReducer:a.eagerReducer,eagerState:a.eagerState,next:null};l===null?(s=l=h,o=i):l=l.next=h,te.lanes|=u,xr|=u}a=a.next}while(a!==null&&a!==r);l===null?o=i:l.next=s,Ve(i,e.memoizedState)||(Je=!0),e.memoizedState=i,e.baseState=o,e.baseQueue=l,n.lastRenderedState=i}return[e.memoizedState,n.dispatch]}function ki(t){var e=pn(),n=e.queue;if(n===null)throw Error(x(311));n.lastRenderedReducer=t;var i=n.dispatch,r=n.pending,o=e.memoizedState;if(r!==null){n.pending=null;var s=r=r.next;do o=t(o,s.action),s=s.next;while(s!==r);Ve(o,e.memoizedState)||(Je=!0),e.memoizedState=o,e.baseQueue===null&&(e.baseState=o),n.lastRenderedState=o}return[o,i]}function Ju(t,e,n){var i=e._getVersion;i=i(e._source);var r=e._workInProgressVersionPrimary;if(r!==null?t=r===i:(t=t.mutableReadLanes,(t=(dr&t)===t)&&(e._workInProgressVersionPrimary=i,Bn.push(e))),t)return n(e._source);throw Bn.push(e),Error(x(350))}function xh(t,e,n,i){var r=Ce;if(r===null)throw Error(x(349));var o=e._getVersion,s=o(e._source),l=ji.current,a=l.useState(function(){return Ju(r,e,n)}),u=a[1],h=a[0];a=ce;var g=t.memoizedState,p=g.refs,w=p.getSnapshot,k=g.source;g=g.subscribe;var $=te;return t.memoizedState={refs:p,source:e,subscribe:i},l.useEffect(function(){p.getSnapshot=n,p.setSnapshot=u;var f=o(e._source);if(!Ve(s,f)){f=n(e._source),Ve(h,f)||(u(f),f=Rt($),r.mutableReadLanes|=f&r.pendingLanes),f=r.mutableReadLanes,r.entangledLanes|=f;for(var c=r.entanglements,d=f;0<d;){var v=31-Lt(d),y=1<<v;c[v]|=f,d&=~y}}},[n,e,i]),l.useEffect(function(){return i(e._source,function(){var f=p.getSnapshot,c=p.setSnapshot;try{c(f(e._source));var d=Rt($);r.mutableReadLanes|=d&r.pendingLanes}catch(v){c(function(){throw v})}})},[e,i]),Ve(w,n)&&Ve(k,e)&&Ve(g,i)||(t={pending:null,dispatch:null,lastRenderedReducer:it,lastRenderedState:h},t.dispatch=u=Ta.bind(null,te,t),a.queue=t,a.baseQueue=null,h=Ju(r,e,n),a.memoizedState=a.baseState=h),h}function kh(t,e,n){var i=pn();return xh(i,t,e,n)}function Ci(t){var e=nn();return typeof t=="function"&&(t=t()),e.memoizedState=e.baseState=t,t=e.queue={pending:null,dispatch:null,lastRenderedReducer:it,lastRenderedState:t},t=t.dispatch=Ta.bind(null,te,t),[e.memoizedState,t]}function Eo(t,e,n,i){return t={tag:t,create:e,destroy:n,deps:i,next:null},e=te.updateQueue,e===null?(e={lastEffect:null},te.updateQueue=e,e.lastEffect=t.next=t):(n=e.lastEffect,n===null?e.lastEffect=t.next=t:(i=n.next,n.next=t,t.next=i,e.lastEffect=t)),t}function Ku(t){var e=nn();return t={current:t},e.memoizedState=t}function To(){return pn().memoizedState}function wl(t,e,n,i){var r=nn();te.flags|=t,r.memoizedState=Eo(1|e,n,void 0,i===void 0?null:i)}function Sa(t,e,n,i){var r=pn();i=i===void 0?null:i;var o=void 0;if(pe!==null){var s=pe.memoizedState;if(o=s.destroy,i!==null&&Ca(i,s.deps)){Eo(e,n,o,i);return}}te.flags|=t,r.memoizedState=Eo(1|e,n,o,i)}function ec(t,e){return wl(516,4,t,e)}function Io(t,e){return Sa(516,4,t,e)}function Ch(t,e){return Sa(4,2,t,e)}function $h(t,e){if(typeof e=="function")return t=t(),e(t),function(){e(null)};if(e!=null)return t=t(),e.current=t,function(){e.current=null}}function Sh(t,e,n){return n=n!=null?n.concat([t]):null,Sa(4,2,$h.bind(null,e,t),n)}function Ea(){}function Eh(t,e){var n=pn();e=e===void 0?null:e;var i=n.memoizedState;return i!==null&&e!==null&&Ca(e,i[1])?i[0]:(n.memoizedState=[t,e],t)}function Th(t,e){var n=pn();e=e===void 0?null:e;var i=n.memoizedState;return i!==null&&e!==null&&Ca(e,i[1])?i[0]:(t=t(),n.memoizedState=[t,e],t)}function ym(t,e){var n=qn();an(98>n?98:n,function(){t(!0)}),an(97<n?97:n,function(){var i=je.transition;je.transition=1;try{t(!1),e()}finally{je.transition=i}})}function Ta(t,e,n){var i=Ne(),r=Rt(t),o={lane:r,action:n,eagerReducer:null,eagerState:null,next:null},s=e.pending;if(s===null?o.next=o:(o.next=s.next,s.next=o),e.pending=o,s=t.alternate,t===te||s!==null&&s===te)Ui=So=!0;else{if(t.lanes===0&&(s===null||s.lanes===0)&&(s=e.lastRenderedReducer,s!==null))try{var l=e.lastRenderedState,a=s(l,n);if(o.eagerReducer=s,o.eagerState=a,Ve(a,l))return}catch{}finally{}Pt(t,r,i)}}var Oo={readContext:Ue,useCallback:Oe,useContext:Oe,useEffect:Oe,useImperativeHandle:Oe,useLayoutEffect:Oe,useMemo:Oe,useReducer:Oe,useRef:Oe,useState:Oe,useDebugValue:Oe,useDeferredValue:Oe,useTransition:Oe,useMutableSource:Oe,useOpaqueIdentifier:Oe,unstable_isNewReconciler:!1},bm={readContext:Ue,useCallback:function(t,e){return nn().memoizedState=[t,e===void 0?null:e],t},useContext:Ue,useEffect:ec,useImperativeHandle:function(t,e,n){return n=n!=null?n.concat([t]):null,wl(4,2,$h.bind(null,e,t),n)},useLayoutEffect:function(t,e){return wl(4,2,t,e)},useMemo:function(t,e){var n=nn();return e=e===void 0?null:e,t=t(),n.memoizedState=[t,e],t},useReducer:function(t,e,n){var i=nn();return e=n!==void 0?n(e):e,i.memoizedState=i.baseState=e,t=i.queue={pending:null,dispatch:null,lastRenderedReducer:t,lastRenderedState:e},t=t.dispatch=Ta.bind(null,te,t),[i.memoizedState,t]},useRef:Ku,useState:Ci,useDebugValue:Ea,useDeferredValue:function(t){var e=Ci(t),n=e[0],i=e[1];return ec(function(){var r=je.transition;je.transition=1;try{i(t)}finally{je.transition=r}},[t]),n},useTransition:function(){var t=Ci(!1),e=t[0];return t=ym.bind(null,t[1]),Ku(t),[t,e]},useMutableSource:function(t,e,n){var i=nn();return i.memoizedState={refs:{getSnapshot:e,setSnapshot:null},source:t,subscribe:n},xh(i,t,e,n)},useOpaqueIdentifier:function(){if(st){var t=!1,e=hm(function(){throw t||(t=!0,n("r:"+($s++).toString(36))),Error(x(355))}),n=Ci(e)[1];return(te.mode&2)===0&&(te.flags|=516,Eo(5,function(){n("r:"+($s++).toString(36))},void 0,null)),e}return e="r:"+($s++).toString(36),Ci(e),e},unstable_isNewReconciler:!1},wm={readContext:Ue,useCallback:Eh,useContext:Ue,useEffect:Io,useImperativeHandle:Sh,useLayoutEffect:Ch,useMemo:Th,useReducer:xi,useRef:To,useState:function(){return xi(it)},useDebugValue:Ea,useDeferredValue:function(t){var e=xi(it),n=e[0],i=e[1];return Io(function(){var r=je.transition;je.transition=1;try{i(t)}finally{je.transition=r}},[t]),n},useTransition:function(){var t=xi(it)[0];return[To().current,t]},useMutableSource:kh,useOpaqueIdentifier:function(){return xi(it)[0]},unstable_isNewReconciler:!1},xm={readContext:Ue,useCallback:Eh,useContext:Ue,useEffect:Io,useImperativeHandle:Sh,useLayoutEffect:Ch,useMemo:Th,useReducer:ki,useRef:To,useState:function(){return ki(it)},useDebugValue:Ea,useDeferredValue:function(t){var e=ki(it),n=e[0],i=e[1];return Io(function(){var r=je.transition;je.transition=1;try{i(t)}finally{je.transition=r}},[t]),n},useTransition:function(){var t=ki(it)[0];return[To().current,t]},useMutableSource:kh,useOpaqueIdentifier:function(){return ki(it)[0]},unstable_isNewReconciler:!1},km=hn.ReactCurrentOwner,Je=!1;function Re(t,e,n,i){e.child=t===null?bh(e,null,n,i):Co(e,t.child,n,i)}function tc(t,e,n,i,r){n=n.render;var o=e.ref;return Fn(e,r),i=$a(t,e,n,i,o,r),t!==null&&!Je?(e.updateQueue=t.updateQueue,e.flags&=-517,t.lanes&=~r,ht(t,e,r)):(e.flags|=1,Re(t,e,i,r),e.child)}function nc(t,e,n,i,r,o){if(t===null){var s=n.type;return typeof s=="function"&&!Aa(s)&&s.defaultProps===void 0&&n.compare===null&&n.defaultProps===void 0?(e.tag=15,e.type=s,Ih(t,e,s,i,r,o)):(t=oo(n.type,null,i,e,e.mode,o),t.ref=e.ref,t.return=e,e.child=t)}return s=t.child,(r&o)===0&&(r=s.memoizedProps,n=n.compare,n=n!==null?n:or,n(r,i)&&t.ref===e.ref)?ht(t,e,o):(e.flags|=1,t=Bt(s,i),t.ref=e.ref,t.return=e,e.child=t)}function Ih(t,e,n,i,r,o){if(t!==null&&or(t.memoizedProps,i)&&t.ref===e.ref)if(Je=!1,(o&r)!==0)(t.flags&16384)!==0&&(Je=!0);else return e.lanes=t.lanes,ht(t,e,o);return xl(t,e,n,i,o)}function Is(t,e,n){var i=e.pendingProps,r=i.children,o=t!==null?t.memoizedState:null;if(i.mode==="hidden"||i.mode==="unstable-defer-without-hiding")if((e.mode&4)===0)e.memoizedState={baseLanes:0},zr(e,n);else if((n&1073741824)!==0)e.memoizedState={baseLanes:0},zr(e,o!==null?o.baseLanes:n);else return t=o!==null?o.baseLanes|n:n,e.lanes=e.childLanes=1073741824,e.memoizedState={baseLanes:t},zr(e,t),null;else o!==null?(i=o.baseLanes|n,e.memoizedState=null):i=n,zr(e,i);return Re(t,e,r,n),e.child}function Oh(t,e){var n=e.ref;(t===null&&n!==null||t!==null&&t.ref!==n)&&(e.flags|=128)}function xl(t,e,n,i,r){var o=De(n)?ln:ye.current;return o=Qn(e,o),Fn(e,r),n=$a(t,e,n,i,o,r),t!==null&&!Je?(e.updateQueue=t.updateQueue,e.flags&=-517,t.lanes&=~r,ht(t,e,r)):(e.flags|=1,Re(t,e,n,r),e.child)}function ic(t,e,n,i,r){if(De(n)){var o=!0;eo(e)}else o=!1;if(Fn(e,r),e.stateNode===null)t!==null&&(t.alternate=null,e.alternate=null,e.flags|=2),vh(e,n,i),vl(e,n,i,r),i=!0;else if(t===null){var s=e.stateNode,l=e.memoizedProps;s.props=l;var a=s.context,u=n.contextType;typeof u=="object"&&u!==null?u=Ue(u):(u=De(n)?ln:ye.current,u=Qn(e,u));var h=n.getDerivedStateFromProps,g=typeof h=="function"||typeof s.getSnapshotBeforeUpdate=="function";g||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(l!==i||a!==u)&&Gu(e,s,i,u),wt=!1;var p=e.memoizedState;s.state=p,ar(e,i,s,r),a=e.memoizedState,l!==i||p!==a||Pe.current||wt?(typeof h=="function"&&(ko(e,n,h,i),a=e.memoizedState),(l=wt||qu(e,n,l,i,p,a,u))?(g||typeof s.UNSAFE_componentWillMount!="function"&&typeof s.componentWillMount!="function"||(typeof s.componentWillMount=="function"&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount=="function"&&s.UNSAFE_componentWillMount()),typeof s.componentDidMount=="function"&&(e.flags|=4)):(typeof s.componentDidMount=="function"&&(e.flags|=4),e.memoizedProps=i,e.memoizedState=a),s.props=i,s.state=a,s.context=u,i=l):(typeof s.componentDidMount=="function"&&(e.flags|=4),i=!1)}else{s=e.stateNode,mh(t,e),l=e.memoizedProps,u=e.type===e.elementType?l:Xe(e.type,l),s.props=u,g=e.pendingProps,p=s.context,a=n.contextType,typeof a=="object"&&a!==null?a=Ue(a):(a=De(n)?ln:ye.current,a=Qn(e,a));var w=n.getDerivedStateFromProps;(h=typeof w=="function"||typeof s.getSnapshotBeforeUpdate=="function")||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(l!==g||p!==a)&&Gu(e,s,i,a),wt=!1,p=e.memoizedState,s.state=p,ar(e,i,s,r);var k=e.memoizedState;l!==g||p!==k||Pe.current||wt?(typeof w=="function"&&(ko(e,n,w,i),k=e.memoizedState),(u=wt||qu(e,n,u,i,p,k,a))?(h||typeof s.UNSAFE_componentWillUpdate!="function"&&typeof s.componentWillUpdate!="function"||(typeof s.componentWillUpdate=="function"&&s.componentWillUpdate(i,k,a),typeof s.UNSAFE_componentWillUpdate=="function"&&s.UNSAFE_componentWillUpdate(i,k,a)),typeof s.componentDidUpdate=="function"&&(e.flags|=4),typeof s.getSnapshotBeforeUpdate=="function"&&(e.flags|=256)):(typeof s.componentDidUpdate!="function"||l===t.memoizedProps&&p===t.memoizedState||(e.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||l===t.memoizedProps&&p===t.memoizedState||(e.flags|=256),e.memoizedProps=i,e.memoizedState=k),s.props=i,s.state=k,s.context=a,i=u):(typeof s.componentDidUpdate!="function"||l===t.memoizedProps&&p===t.memoizedState||(e.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||l===t.memoizedProps&&p===t.memoizedState||(e.flags|=256),i=!1)}return kl(t,e,n,i,o,r)}function kl(t,e,n,i,r,o){Oh(t,e);var s=(e.flags&64)!==0;if(!i&&!s)return r&&Hu(e,n,!1),ht(t,e,o);i=e.stateNode,km.current=e;var l=s&&typeof n.getDerivedStateFromError!="function"?null:i.render();return e.flags|=1,t!==null&&s?(e.child=Co(e,t.child,null,o),e.child=Co(e,null,l,o)):Re(t,e,l,o),e.memoizedState=i.state,r&&Hu(e,n,!0),e.child}function rc(t){var e=t.stateNode;e.pendingContext?Vu(t,e.pendingContext,e.pendingContext!==e.context):e.context&&Vu(t,e.context,!1),yl(t,e.containerInfo)}var Mr={dehydrated:null,retryLane:0};function oc(t,e,n){var i=e.pendingProps,r=Z.current,o=!1,s;return(s=(e.flags&64)!==0)||(s=t!==null&&t.memoizedState===null?!1:(r&2)!==0),s?(o=!0,e.flags&=-65):t!==null&&t.memoizedState===null||i.fallback===void 0||i.unstable_avoidThisFallback===!0||(r|=1),J(Z,r&1),t===null?(i.fallback!==void 0&&bl(e),t=i.children,r=i.fallback,o?(t=sc(e,t,r,n),e.child.memoizedState={baseLanes:n},e.memoizedState=Mr,t):typeof i.unstable_expectedLoadTime=="number"?(t=sc(e,t,r,n),e.child.memoizedState={baseLanes:n},e.memoizedState=Mr,e.lanes=33554432,t):(n=_a({mode:"visible",children:t},e.mode,n,null),n.return=e,e.child=n)):t.memoizedState!==null?o?(i=ac(t,e,i.children,i.fallback,n),o=e.child,r=t.child.memoizedState,o.memoizedState=r===null?{baseLanes:n}:{baseLanes:r.baseLanes|n},o.childLanes=t.childLanes&~n,e.memoizedState=Mr,i):(n=lc(t,e,i.children,n),e.memoizedState=null,n):o?(i=ac(t,e,i.children,i.fallback,n),o=e.child,r=t.child.memoizedState,o.memoizedState=r===null?{baseLanes:n}:{baseLanes:r.baseLanes|n},o.childLanes=t.childLanes&~n,e.memoizedState=Mr,i):(n=lc(t,e,i.children,n),e.memoizedState=null,n)}function sc(t,e,n,i){var r=t.mode,o=t.child;return e={mode:"hidden",children:e},(r&2)===0&&o!==null?(o.childLanes=0,o.pendingProps=e):o=_a(e,r,0,null),n=Vn(n,r,i,null),o.return=t,n.return=t,o.sibling=n,t.child=o,n}function lc(t,e,n,i){var r=t.child;return t=r.sibling,n=Bt(r,{mode:"visible",children:n}),(e.mode&2)===0&&(n.lanes=i),n.return=e,n.sibling=null,t!==null&&(t.nextEffect=null,t.flags=8,e.firstEffect=e.lastEffect=t),e.child=n}function ac(t,e,n,i,r){var o=e.mode,s=t.child;t=s.sibling;var l={mode:"hidden",children:n};return(o&2)===0&&e.child!==s?(n=e.child,n.childLanes=0,n.pendingProps=l,s=n.lastEffect,s!==null?(e.firstEffect=n.firstEffect,e.lastEffect=s,s.nextEffect=null):e.firstEffect=e.lastEffect=null):n=Bt(s,l),t!==null?i=Bt(t,i):(i=Vn(i,o,r,null),i.flags|=2),i.return=e,n.return=e,n.sibling=i,e.child=n,i}function uc(t,e){t.lanes|=e;var n=t.alternate;n!==null&&(n.lanes|=e),ph(t.return,e)}function Os(t,e,n,i,r,o){var s=t.memoizedState;s===null?t.memoizedState={isBackwards:e,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:r,lastEffect:o}:(s.isBackwards=e,s.rendering=null,s.renderingStartTime=0,s.last=i,s.tail=n,s.tailMode=r,s.lastEffect=o)}function cc(t,e,n){var i=e.pendingProps,r=i.revealOrder,o=i.tail;if(Re(t,e,i.children,n),i=Z.current,(i&2)!==0)i=i&1|2,e.flags|=64;else{if(t!==null&&(t.flags&64)!==0)e:for(t=e.child;t!==null;){if(t.tag===13)t.memoizedState!==null&&uc(t,n);else if(t.tag===19)uc(t,n);else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;t=t.return}t.sibling.return=t.return,t=t.sibling}i&=1}if(J(Z,i),(e.mode&2)===0)e.memoizedState=null;else switch(r){case"forwards":for(n=e.child,r=null;n!==null;)t=n.alternate,t!==null&&$o(t)===null&&(r=n),n=n.sibling;n=r,n===null?(r=e.child,e.child=null):(r=n.sibling,n.sibling=null),Os(e,!1,r,n,o,e.lastEffect);break;case"backwards":for(n=null,r=e.child,e.child=null;r!==null;){if(t=r.alternate,t!==null&&$o(t)===null){e.child=r;break}t=r.sibling,r.sibling=n,n=r,r=t}Os(e,!0,n,null,o,e.lastEffect);break;case"together":Os(e,!1,null,null,void 0,e.lastEffect);break;default:e.memoizedState=null}return e.child}function ht(t,e,n){if(t!==null&&(e.dependencies=t.dependencies),xr|=e.lanes,(n&e.childLanes)!==0){if(t!==null&&e.child!==t.child)throw Error(x(153));if(e.child!==null){for(t=e.child,n=Bt(t,t.pendingProps),e.child=n,n.return=e;t.sibling!==null;)t=t.sibling,n=n.sibling=Bt(t,t.pendingProps),n.return=e;n.sibling=null}return e.child}return null}var Rh,Cl,Ph,Dh;Rh=function(t,e){for(var n=e.child;n!==null;){if(n.tag===5||n.tag===6)t.appendChild(n.stateNode);else if(n.tag!==4&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break;for(;n.sibling===null;){if(n.return===null||n.return===e)return;n=n.return}n.sibling.return=n.return,n=n.sibling}};Cl=function(){};Ph=function(t,e,n,i){var r=t.memoizedProps;if(r!==i){t=e.stateNode,tn(ot.current);var o=null;switch(n){case"input":r=Xs(t,r),i=Xs(t,i),o=[];break;case"option":r=Ks(t,r),i=Ks(t,i),o=[];break;case"select":r=Q({},r,{value:void 0}),i=Q({},i,{value:void 0}),o=[];break;case"textarea":r=el(t,r),i=el(t,i),o=[];break;default:typeof r.onClick!="function"&&typeof i.onClick=="function"&&(t.onclick=go)}il(n,i);var s;n=null;for(u in r)if(!i.hasOwnProperty(u)&&r.hasOwnProperty(u)&&r[u]!=null)if(u==="style"){var l=r[u];for(s in l)l.hasOwnProperty(s)&&(n||(n={}),n[s]="")}else u!=="dangerouslySetInnerHTML"&&u!=="children"&&u!=="suppressContentEditableWarning"&&u!=="suppressHydrationWarning"&&u!=="autoFocus"&&(Ji.hasOwnProperty(u)?o||(o=[]):(o=o||[]).push(u,null));for(u in i){var a=i[u];if(l=r!=null?r[u]:void 0,i.hasOwnProperty(u)&&a!==l&&(a!=null||l!=null))if(u==="style")if(l){for(s in l)!l.hasOwnProperty(s)||a&&a.hasOwnProperty(s)||(n||(n={}),n[s]="");for(s in a)a.hasOwnProperty(s)&&l[s]!==a[s]&&(n||(n={}),n[s]=a[s])}else n||(o||(o=[]),o.push(u,n)),n=a;else u==="dangerouslySetInnerHTML"?(a=a?a.__html:void 0,l=l?l.__html:void 0,a!=null&&l!==a&&(o=o||[]).push(u,a)):u==="children"?typeof a!="string"&&typeof a!="number"||(o=o||[]).push(u,""+a):u!=="suppressContentEditableWarning"&&u!=="suppressHydrationWarning"&&(Ji.hasOwnProperty(u)?(a!=null&&u==="onScroll"&&j("scroll",t),o||l===a||(o=[])):typeof a=="object"&&a!==null&&a.$$typeof===ea?a.toString():(o=o||[]).push(u,a))}n&&(o=o||[]).push("style",n);var u=o;(e.updateQueue=u)&&(e.flags|=4)}};Dh=function(t,e,n,i){n!==i&&(e.flags|=4)};function $i(t,e){if(!st)switch(t.tailMode){case"hidden":e=t.tail;for(var n=null;e!==null;)e.alternate!==null&&(n=e),e=e.sibling;n===null?t.tail=null:n.sibling=null;break;case"collapsed":n=t.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?e||t.tail===null?t.tail=null:t.tail.sibling=null:i.sibling=null}}function Cm(t,e,n){var i=e.pendingProps;switch(e.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return null;case 1:return De(e.type)&&yo(),null;case 3:return Gn(),U(Pe),U(ye),ka(),i=e.stateNode,i.pendingContext&&(i.context=i.pendingContext,i.pendingContext=null),(t===null||t.child===null)&&(Br(e)?e.flags|=4:i.hydrate||(e.flags|=256)),Cl(e),null;case 5:xa(e);var r=tn(cr.current);if(n=e.type,t!==null&&e.stateNode!=null)Ph(t,e,n,i,r),t.ref!==e.ref&&(e.flags|=128);else{if(!i){if(e.stateNode===null)throw Error(x(166));return null}if(t=tn(ot.current),Br(e)){i=e.stateNode,n=e.type;var o=e.memoizedProps;switch(i[Ct]=e,i[vo]=o,n){case"dialog":j("cancel",i),j("close",i);break;case"iframe":case"object":case"embed":j("load",i);break;case"video":case"audio":for(t=0;t<Ai.length;t++)j(Ai[t],i);break;case"source":j("error",i);break;case"img":case"image":case"link":j("error",i),j("load",i);break;case"details":j("toggle",i);break;case"input":cu(i,o),j("invalid",i);break;case"select":i._wrapperState={wasMultiple:!!o.multiple},j("invalid",i);break;case"textarea":hu(i,o),j("invalid",i)}il(n,o),t=null;for(var s in o)o.hasOwnProperty(s)&&(r=o[s],s==="children"?typeof r=="string"?i.textContent!==r&&(t=["children",r]):typeof r=="number"&&i.textContent!==""+r&&(t=["children",""+r]):Ji.hasOwnProperty(s)&&r!=null&&s==="onScroll"&&j("scroll",i));switch(n){case"input":Dr(i),du(i,o,!0);break;case"textarea":Dr(i),fu(i);break;case"select":case"option":break;default:typeof o.onClick=="function"&&(i.onclick=go)}i=t,e.updateQueue=i,i!==null&&(e.flags|=4)}else{switch(s=r.nodeType===9?r:r.ownerDocument,t===tl.html&&(t=Sd(n)),t===tl.html?n==="script"?(t=s.createElement("div"),t.innerHTML="<script><\/script>",t=t.removeChild(t.firstChild)):typeof i.is=="string"?t=s.createElement(n,{is:i.is}):(t=s.createElement(n),n==="select"&&(s=t,i.multiple?s.multiple=!0:i.size&&(s.size=i.size))):t=s.createElementNS(t,n),t[Ct]=e,t[vo]=i,Rh(t,e,!1,!1),e.stateNode=t,s=rl(n,i),n){case"dialog":j("cancel",t),j("close",t),r=i;break;case"iframe":case"object":case"embed":j("load",t),r=i;break;case"video":case"audio":for(r=0;r<Ai.length;r++)j(Ai[r],t);r=i;break;case"source":j("error",t),r=i;break;case"img":case"image":case"link":j("error",t),j("load",t),r=i;break;case"details":j("toggle",t),r=i;break;case"input":cu(t,i),r=Xs(t,i),j("invalid",t);break;case"option":r=Ks(t,i);break;case"select":t._wrapperState={wasMultiple:!!i.multiple},r=Q({},i,{value:void 0}),j("invalid",t);break;case"textarea":hu(t,i),r=el(t,i),j("invalid",t);break;default:r=i}il(n,r);var l=r;for(o in l)if(l.hasOwnProperty(o)){var a=l[o];o==="style"?Id(t,a):o==="dangerouslySetInnerHTML"?(a=a?a.__html:void 0,a!=null&&Ed(t,a)):o==="children"?typeof a=="string"?(n!=="textarea"||a!=="")&&Ki(t,a):typeof a=="number"&&Ki(t,""+a):o!=="suppressContentEditableWarning"&&o!=="suppressHydrationWarning"&&o!=="autoFocus"&&(Ji.hasOwnProperty(o)?a!=null&&o==="onScroll"&&j("scroll",t):a!=null&&Gl(t,o,a,s))}switch(n){case"input":Dr(t),du(t,i,!1);break;case"textarea":Dr(t),fu(t);break;case"option":i.value!=null&&t.setAttribute("value",""+_t(i.value));break;case"select":t.multiple=!!i.multiple,o=i.value,o!=null?An(t,!!i.multiple,o,!1):i.defaultValue!=null&&An(t,!!i.multiple,i.defaultValue,!0);break;default:typeof r.onClick=="function"&&(t.onclick=go)}oh(n,i)&&(e.flags|=4)}e.ref!==null&&(e.flags|=128)}return null;case 6:if(t&&e.stateNode!=null)Dh(t,e,t.memoizedProps,i);else{if(typeof i!="string"&&e.stateNode===null)throw Error(x(166));n=tn(cr.current),tn(ot.current),Br(e)?(i=e.stateNode,n=e.memoizedProps,i[Ct]=e,i.nodeValue!==n&&(e.flags|=4)):(i=(n.nodeType===9?n:n.ownerDocument).createTextNode(i),i[Ct]=e,e.stateNode=i)}return null;case 13:return U(Z),i=e.memoizedState,(e.flags&64)!==0?(e.lanes=n,e):(i=i!==null,n=!1,t===null?e.memoizedProps.fallback!==void 0&&Br(e):n=t.memoizedState!==null,i&&!n&&(e.mode&2)!==0&&(t===null&&e.memoizedProps.unstable_avoidThisFallback!==!0||(Z.current&1)!==0?de===0&&(de=3):((de===0||de===3)&&(de=4),Ce===null||(xr&134217727)===0&&(ii&134217727)===0||Mn(Ce,ge))),(i||n)&&(e.flags|=4),null);case 4:return Gn(),Cl(e),t===null&&nh(e.stateNode.containerInfo),null;case 10:return ba(e),null;case 17:return De(e.type)&&yo(),null;case 19:if(U(Z),i=e.memoizedState,i===null)return null;if(o=(e.flags&64)!==0,s=i.rendering,s===null)if(o)$i(i,!1);else{if(de!==0||t!==null&&(t.flags&64)!==0)for(t=e.child;t!==null;){if(s=$o(t),s!==null){for(e.flags|=64,$i(i,!1),o=s.updateQueue,o!==null&&(e.updateQueue=o,e.flags|=4),i.lastEffect===null&&(e.firstEffect=null),e.lastEffect=i.lastEffect,i=n,n=e.child;n!==null;)o=n,t=i,o.flags&=2,o.nextEffect=null,o.firstEffect=null,o.lastEffect=null,s=o.alternate,s===null?(o.childLanes=0,o.lanes=t,o.child=null,o.memoizedProps=null,o.memoizedState=null,o.updateQueue=null,o.dependencies=null,o.stateNode=null):(o.childLanes=s.childLanes,o.lanes=s.lanes,o.child=s.child,o.memoizedProps=s.memoizedProps,o.memoizedState=s.memoizedState,o.updateQueue=s.updateQueue,o.type=s.type,t=s.dependencies,o.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),n=n.sibling;return J(Z,Z.current&1|2),e.child}t=t.sibling}i.tail!==null&&me()>Ol&&(e.flags|=64,o=!0,$i(i,!1),e.lanes=33554432)}else{if(!o)if(t=$o(s),t!==null){if(e.flags|=64,o=!0,n=t.updateQueue,n!==null&&(e.updateQueue=n,e.flags|=4),$i(i,!0),i.tail===null&&i.tailMode==="hidden"&&!s.alternate&&!st)return e=e.lastEffect=i.lastEffect,e!==null&&(e.nextEffect=null),null}else 2*me()-i.renderingStartTime>Ol&&n!==1073741824&&(e.flags|=64,o=!0,$i(i,!1),e.lanes=33554432);i.isBackwards?(s.sibling=e.child,e.child=s):(n=i.last,n!==null?n.sibling=s:e.child=s,i.last=s)}return i.tail!==null?(n=i.tail,i.rendering=n,i.tail=n.sibling,i.lastEffect=e.lastEffect,i.renderingStartTime=me(),n.sibling=null,e=Z.current,J(Z,o?e&1|2:e&1),n):null;case 23:case 24:return Da(),t!==null&&t.memoizedState!==null!=(e.memoizedState!==null)&&i.mode!=="unstable-defer-without-hiding"&&(e.flags|=4),null}throw Error(x(156,e.tag))}function $m(t){switch(t.tag){case 1:De(t.type)&&yo();var e=t.flags;return e&4096?(t.flags=e&-4097|64,t):null;case 3:if(Gn(),U(Pe),U(ye),ka(),e=t.flags,(e&64)!==0)throw Error(x(285));return t.flags=e&-4097|64,t;case 5:return xa(t),null;case 13:return U(Z),e=t.flags,e&4096?(t.flags=e&-4097|64,t):null;case 19:return U(Z),null;case 4:return Gn(),null;case 10:return ba(t),null;case 23:case 24:return Da(),null;default:return null}}function Ia(t,e){try{var n="",i=e;do n+=rp(i),i=i.return;while(i);var r=n}catch(o){r=`
Error generating stack: `+o.message+`
`+o.stack}return{value:t,source:e,stack:r}}function $l(t,e){try{console.error(e.value)}catch(n){setTimeout(function(){throw n})}}var Sm=typeof WeakMap=="function"?WeakMap:Map;function Ah(t,e,n){n=It(-1,n),n.tag=3,n.payload={element:null};var i=e.value;return n.callback=function(){Po||(Po=!0,Rl=i),$l(t,e)},n}function _h(t,e,n){n=It(-1,n),n.tag=3;var i=t.type.getDerivedStateFromError;if(typeof i=="function"){var r=e.value;n.payload=function(){return $l(t,e),i(r)}}var o=t.stateNode;return o!==null&&typeof o.componentDidCatch=="function"&&(n.callback=function(){typeof i!="function"&&(rt===null?rt=new Set([this]):rt.add(this),$l(t,e));var s=e.stack;this.componentDidCatch(e.value,{componentStack:s!==null?s:""})}),n}var Em=typeof WeakSet=="function"?WeakSet:Set;function dc(t){var e=t.ref;if(e!==null)if(typeof e=="function")try{e(null)}catch(n){Dt(t,n)}else e.current=null}function Tm(t,e){switch(e.tag){case 0:case 11:case 15:case 22:return;case 1:if(e.flags&256&&t!==null){var n=t.memoizedProps,i=t.memoizedState;t=e.stateNode,e=t.getSnapshotBeforeUpdate(e.elementType===e.type?n:Xe(e.type,n),i),t.__reactInternalSnapshotBeforeUpdate=e}return;case 3:e.flags&256&&ma(e.stateNode.containerInfo);return;case 5:case 6:case 4:case 17:return}throw Error(x(163))}function Im(t,e,n){switch(n.tag){case 0:case 11:case 15:case 22:if(e=n.updateQueue,e=e!==null?e.lastEffect:null,e!==null){t=e=e.next;do{if((t.tag&3)===3){var i=t.create;t.destroy=i()}t=t.next}while(t!==e)}if(e=n.updateQueue,e=e!==null?e.lastEffect:null,e!==null){t=e=e.next;do{var r=t;i=r.next,r=r.tag,(r&4)!==0&&(r&1)!==0&&(jh(n,t),Nm(n,t)),t=i}while(t!==e)}return;case 1:t=n.stateNode,n.flags&4&&(e===null?t.componentDidMount():(i=n.elementType===n.type?e.memoizedProps:Xe(n.type,e.memoizedProps),t.componentDidUpdate(i,e.memoizedState,t.__reactInternalSnapshotBeforeUpdate))),e=n.updateQueue,e!==null&&Qu(n,e,t);return;case 3:if(e=n.updateQueue,e!==null){if(t=null,n.child!==null)switch(n.child.tag){case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}Qu(n,e,t)}return;case 5:t=n.stateNode,e===null&&n.flags&4&&oh(n.type,n.memoizedProps)&&t.focus();return;case 6:return;case 4:return;case 12:return;case 13:n.memoizedState===null&&(n=n.alternate,n!==null&&(n=n.memoizedState,n!==null&&(n=n.dehydrated,n!==null&&Bd(n))));return;case 19:case 17:case 20:case 21:case 23:case 24:return}throw Error(x(163))}function hc(t,e){for(var n=t;;){if(n.tag===5){var i=n.stateNode;if(e)i=i.style,typeof i.setProperty=="function"?i.setProperty("display","none","important"):i.display="none";else{i=n.stateNode;var r=n.memoizedProps.style;r=r!=null&&r.hasOwnProperty("display")?r.display:null,i.style.display=Td("display",r)}}else if(n.tag===6)n.stateNode.nodeValue=e?"":n.memoizedProps;else if((n.tag!==23&&n.tag!==24||n.memoizedState===null||n===t)&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===t)break;for(;n.sibling===null;){if(n.return===null||n.return===t)return;n=n.return}n.sibling.return=n.return,n=n.sibling}}function fc(t,e){if(on&&typeof on.onCommitFiberUnmount=="function")try{on.onCommitFiberUnmount(ga,e)}catch{}switch(e.tag){case 0:case 11:case 14:case 15:case 22:if(t=e.updateQueue,t!==null&&(t=t.lastEffect,t!==null)){var n=t=t.next;do{var i=n,r=i.destroy;if(i=i.tag,r!==void 0)if((i&4)!==0)jh(e,n);else{i=e;try{r()}catch(o){Dt(i,o)}}n=n.next}while(n!==t)}break;case 1:if(dc(e),t=e.stateNode,typeof t.componentWillUnmount=="function")try{t.props=e.memoizedProps,t.state=e.memoizedState,t.componentWillUnmount()}catch(o){Dt(e,o)}break;case 5:dc(e);break;case 4:Lh(t,e)}}function pc(t){t.alternate=null,t.child=null,t.dependencies=null,t.firstEffect=null,t.lastEffect=null,t.memoizedProps=null,t.memoizedState=null,t.pendingProps=null,t.return=null,t.updateQueue=null}function mc(t){return t.tag===5||t.tag===3||t.tag===4}function gc(t){e:{for(var e=t.return;e!==null;){if(mc(e))break e;e=e.return}throw Error(x(160))}var n=e;switch(e=n.stateNode,n.tag){case 5:var i=!1;break;case 3:e=e.containerInfo,i=!0;break;case 4:e=e.containerInfo,i=!0;break;default:throw Error(x(161))}n.flags&16&&(Ki(e,""),n.flags&=-17);e:t:for(n=t;;){for(;n.sibling===null;){if(n.return===null||mc(n.return)){n=null;break e}n=n.return}for(n.sibling.return=n.return,n=n.sibling;n.tag!==5&&n.tag!==6&&n.tag!==18;){if(n.flags&2||n.child===null||n.tag===4)continue t;n.child.return=n,n=n.child}if(!(n.flags&2)){n=n.stateNode;break e}}i?Sl(t,n,e):El(t,n,e)}function Sl(t,e,n){var i=t.tag,r=i===5||i===6;if(r)t=r?t.stateNode:t.stateNode.instance,e?n.nodeType===8?n.parentNode.insertBefore(t,e):n.insertBefore(t,e):(n.nodeType===8?(e=n.parentNode,e.insertBefore(t,n)):(e=n,e.appendChild(t)),n=n._reactRootContainer,n!=null||e.onclick!==null||(e.onclick=go));else if(i!==4&&(t=t.child,t!==null))for(Sl(t,e,n),t=t.sibling;t!==null;)Sl(t,e,n),t=t.sibling}function El(t,e,n){var i=t.tag,r=i===5||i===6;if(r)t=r?t.stateNode:t.stateNode.instance,e?n.insertBefore(t,e):n.appendChild(t);else if(i!==4&&(t=t.child,t!==null))for(El(t,e,n),t=t.sibling;t!==null;)El(t,e,n),t=t.sibling}function Lh(t,e){for(var n=e,i=!1,r,o;;){if(!i){i=n.return;e:for(;;){if(i===null)throw Error(x(160));switch(r=i.stateNode,i.tag){case 5:o=!1;break e;case 3:r=r.containerInfo,o=!0;break e;case 4:r=r.containerInfo,o=!0;break e}i=i.return}i=!0}if(n.tag===5||n.tag===6){e:for(var s=t,l=n,a=l;;)if(fc(s,a),a.child!==null&&a.tag!==4)a.child.return=a,a=a.child;else{if(a===l)break e;for(;a.sibling===null;){if(a.return===null||a.return===l)break e;a=a.return}a.sibling.return=a.return,a=a.sibling}o?(s=r,l=n.stateNode,s.nodeType===8?s.parentNode.removeChild(l):s.removeChild(l)):r.removeChild(n.stateNode)}else if(n.tag===4){if(n.child!==null){r=n.stateNode.containerInfo,o=!0,n.child.return=n,n=n.child;continue}}else if(fc(t,n),n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break;for(;n.sibling===null;){if(n.return===null||n.return===e)return;n=n.return,n.tag===4&&(i=!1)}n.sibling.return=n.return,n=n.sibling}}function Rs(t,e){switch(e.tag){case 0:case 11:case 14:case 15:case 22:var n=e.updateQueue;if(n=n!==null?n.lastEffect:null,n!==null){var i=n=n.next;do(i.tag&3)===3&&(t=i.destroy,i.destroy=void 0,t!==void 0&&t()),i=i.next;while(i!==n)}return;case 1:return;case 5:if(n=e.stateNode,n!=null){i=e.memoizedProps;var r=t!==null?t.memoizedProps:i;t=e.type;var o=e.updateQueue;if(e.updateQueue=null,o!==null){for(n[vo]=i,t==="input"&&i.type==="radio"&&i.name!=null&&Cd(n,i),rl(t,r),e=rl(t,i),r=0;r<o.length;r+=2){var s=o[r],l=o[r+1];s==="style"?Id(n,l):s==="dangerouslySetInnerHTML"?Ed(n,l):s==="children"?Ki(n,l):Gl(n,s,l,e)}switch(t){case"input":Zs(n,i);break;case"textarea":$d(n,i);break;case"select":t=n._wrapperState.wasMultiple,n._wrapperState.wasMultiple=!!i.multiple,o=i.value,o!=null?An(n,!!i.multiple,o,!1):t!==!!i.multiple&&(i.defaultValue!=null?An(n,!!i.multiple,i.defaultValue,!0):An(n,!!i.multiple,i.multiple?[]:"",!1))}}}return;case 6:if(e.stateNode===null)throw Error(x(162));e.stateNode.nodeValue=e.memoizedProps;return;case 3:n=e.stateNode,n.hydrate&&(n.hydrate=!1,Bd(n.containerInfo));return;case 12:return;case 13:e.memoizedState!==null&&(Pa=me(),hc(e.child,!0)),vc(e);return;case 19:vc(e);return;case 17:return;case 23:case 24:hc(e,e.memoizedState!==null);return}throw Error(x(163))}function vc(t){var e=t.updateQueue;if(e!==null){t.updateQueue=null;var n=t.stateNode;n===null&&(n=t.stateNode=new Em),e.forEach(function(i){var r=Mm.bind(null,t,i);n.has(i)||(n.add(i),i.then(r,r))})}}function Om(t,e){return t!==null&&(t=t.memoizedState,t===null||t.dehydrated!==null)?(e=e.memoizedState,e!==null&&e.dehydrated===null):!1}var Rm=Math.ceil,Ro=hn.ReactCurrentDispatcher,Oa=hn.ReactCurrentOwner,A=0,Ce=null,ne=null,ge=0,un=0,Tl=Vt(0),de=0,Xo=null,ni=0,xr=0,ii=0,Ra=0,Il=null,Pa=0,Ol=1/0;function ri(){Ol=me()+500}var T=null,Po=!1,Rl=null,rt=null,Ft=!1,Wi=null,_i=90,Pl=[],Dl=[],pt=null,Qi=0,Al=null,no=-1,ct=0,io=0,qi=null,ro=!1;function Ne(){return(A&48)!==0?me():no!==-1?no:no=me()}function Rt(t){if(t=t.mode,(t&2)===0)return 1;if((t&4)===0)return qn()===99?1:2;if(ct===0&&(ct=ni),vm.transition!==0){io!==0&&(io=Il!==null?Il.pendingLanes:0),t=ct;var e=4186112&~io;return e&=-e,e===0&&(t=4186112&~t,e=t&-t,e===0&&(e=8192)),e}return t=qn(),(A&4)!==0&&t===98?t=po(12,ct):(t=wp(t),t=po(t,ct)),t}function Pt(t,e,n){if(50<Qi)throw Qi=0,Al=null,Error(x(185));if(t=Zo(t,e),t===null)return null;jo(t,e,n),t===Ce&&(ii|=e,de===4&&Mn(t,ge));var i=qn();e===1?(A&8)!==0&&(A&48)===0?_l(t):(We(t,n),A===0&&(ri(),lt())):((A&4)===0||i!==98&&i!==99||(pt===null?pt=new Set([t]):pt.add(t)),We(t,n)),Il=t}function Zo(t,e){t.lanes|=e;var n=t.alternate;for(n!==null&&(n.lanes|=e),n=t,t=t.return;t!==null;)t.childLanes|=e,n=t.alternate,n!==null&&(n.childLanes|=e),n=t,t=t.return;return n.tag===3?n.stateNode:null}function We(t,e){for(var n=t.callbackNode,i=t.suspendedLanes,r=t.pingedLanes,o=t.expirationTimes,s=t.pendingLanes;0<s;){var l=31-Lt(s),a=1<<l,u=o[l];if(u===-1){if((a&i)===0||(a&r)!==0){u=e,xn(a);var h=H;o[l]=10<=h?u+250:6<=h?u+5e3:-1}}else u<=e&&(t.expiredLanes|=a);s&=~a}if(i=ir(t,t===Ce?ge:0),e=H,i===0)n!==null&&(n!==Ss&&ml(n),t.callbackNode=null,t.callbackPriority=0);else{if(n!==null){if(t.callbackPriority===e)return;n!==Ss&&ml(n)}e===15?(n=_l.bind(null,t),at===null?(at=[n],to=va(Go,fh)):at.push(n),n=Ss):e===14?n=lr(99,_l.bind(null,t)):(n=xp(e),n=lr(n,Nh.bind(null,t))),t.callbackPriority=e,t.callbackNode=n}}function Nh(t){if(no=-1,io=ct=0,(A&48)!==0)throw Error(x(327));var e=t.callbackNode;if(Ht()&&t.callbackNode!==e)return null;var n=ir(t,t===Ce?ge:0);if(n===0)return null;var i=n,r=A;A|=16;var o=zh();(Ce!==t||ge!==i)&&(ri(),zn(t,i));do try{Am();break}catch(l){Mh(t,l)}while(1);if(ya(),Ro.current=o,A=r,ne!==null?i=0:(Ce=null,ge=0,i=de),(ni&ii)!==0)zn(t,0);else if(i!==0){if(i===2&&(A|=64,t.hydrate&&(t.hydrate=!1,ma(t.containerInfo)),n=Wd(t),n!==0&&(i=Li(t,n))),i===1)throw e=Xo,zn(t,0),Mn(t,n),We(t,me()),e;switch(t.finishedWork=t.current.alternate,t.finishedLanes=n,i){case 0:case 1:throw Error(x(345));case 2:Xt(t);break;case 3:if(Mn(t,n),(n&62914560)===n&&(i=Pa+500-me(),10<i)){if(ir(t,0)!==0)break;if(r=t.suspendedLanes,(r&n)!==n){Ne(),t.pingedLanes|=t.suspendedLanes&r;break}t.timeoutHandle=Bu(Xt.bind(null,t),i);break}Xt(t);break;case 4:if(Mn(t,n),(n&4186112)===n)break;for(i=t.eventTimes,r=-1;0<n;){var s=31-Lt(n);o=1<<s,s=i[s],s>r&&(r=s),n&=~o}if(n=r,n=me()-n,n=(120>n?120:480>n?480:1080>n?1080:1920>n?1920:3e3>n?3e3:4320>n?4320:1960*Rm(n/1960))-n,10<n){t.timeoutHandle=Bu(Xt.bind(null,t),n);break}Xt(t);break;case 5:Xt(t);break;default:throw Error(x(329))}}return We(t,me()),t.callbackNode===e?Nh.bind(null,t):null}function Mn(t,e){for(e&=~Ra,e&=~ii,t.suspendedLanes|=e,t.pingedLanes&=~e,t=t.expirationTimes;0<e;){var n=31-Lt(e),i=1<<n;t[n]=-1,e&=~i}}function _l(t){if((A&48)!==0)throw Error(x(327));if(Ht(),t===Ce&&(t.expiredLanes&ge)!==0){var e=ge,n=Li(t,e);(ni&ii)!==0&&(e=ir(t,e),n=Li(t,e))}else e=ir(t,0),n=Li(t,e);if(t.tag!==0&&n===2&&(A|=64,t.hydrate&&(t.hydrate=!1,ma(t.containerInfo)),e=Wd(t),e!==0&&(n=Li(t,e))),n===1)throw n=Xo,zn(t,0),Mn(t,e),We(t,me()),n;return t.finishedWork=t.current.alternate,t.finishedLanes=e,Xt(t),We(t,me()),null}function Pm(){if(pt!==null){var t=pt;pt=null,t.forEach(function(e){e.expiredLanes|=24&e.pendingLanes,We(e,me())})}lt()}function Fh(t,e){var n=A;A|=1;try{return t(e)}finally{A=n,A===0&&(ri(),lt())}}function Bh(t,e){var n=A;A&=-2,A|=8;try{return t(e)}finally{A=n,A===0&&(ri(),lt())}}function zr(t,e){J(Tl,un),un|=e,ni|=e}function Da(){un=Tl.current,U(Tl)}function zn(t,e){t.finishedWork=null,t.finishedLanes=0;var n=t.timeoutHandle;if(n!==-1&&(t.timeoutHandle=-1,dm(n)),ne!==null)for(n=ne.return;n!==null;){var i=n;switch(i.tag){case 1:i=i.type.childContextTypes,i!=null&&yo();break;case 3:Gn(),U(Pe),U(ye),ka();break;case 5:xa(i);break;case 4:Gn();break;case 13:U(Z);break;case 19:U(Z);break;case 10:ba(i);break;case 23:case 24:Da()}n=n.return}Ce=t,ne=Bt(t.current,null),ge=un=ni=e,de=0,Xo=null,Ra=ii=xr=0}function Mh(t,e){do{var n=ne;try{if(ya(),ji.current=Oo,So){for(var i=te.memoizedState;i!==null;){var r=i.queue;r!==null&&(r.pending=null),i=i.next}So=!1}if(dr=0,ce=pe=te=null,Ui=!1,Oa.current=null,n===null||n.return===null){de=1,Xo=e,ne=null;break}e:{var o=t,s=n.return,l=n,a=e;if(e=ge,l.flags|=2048,l.firstEffect=l.lastEffect=null,a!==null&&typeof a=="object"&&typeof a.then=="function"){var u=a;if((l.mode&2)===0){var h=l.alternate;h?(l.updateQueue=h.updateQueue,l.memoizedState=h.memoizedState,l.lanes=h.lanes):(l.updateQueue=null,l.memoizedState=null)}var g=(Z.current&1)!==0,p=s;do{var w;if(w=p.tag===13){var k=p.memoizedState;if(k!==null)w=k.dehydrated!==null;else{var $=p.memoizedProps;w=$.fallback===void 0?!1:$.unstable_avoidThisFallback!==!0?!0:!g}}if(w){var f=p.updateQueue;if(f===null){var c=new Set;c.add(u),p.updateQueue=c}else f.add(u);if((p.mode&2)===0){if(p.flags|=64,l.flags|=16384,l.flags&=-2981,l.tag===1)if(l.alternate===null)l.tag=17;else{var d=It(-1,1);d.tag=2,Ot(l,d)}l.lanes|=1;break e}a=void 0,l=e;var v=o.pingCache;if(v===null?(v=o.pingCache=new Sm,a=new Set,v.set(u,a)):(a=v.get(u),a===void 0&&(a=new Set,v.set(u,a))),!a.has(l)){a.add(l);var y=Bm.bind(null,o,u,l);u.then(y,y)}p.flags|=4096,p.lanes=e;break e}p=p.return}while(p!==null);a=Error((Dn(l.type)||"A React component")+` suspended while rendering, but no fallback UI was specified.

Add a <Suspense fallback=...> component higher in the tree to provide a loading indicator or placeholder to display.`)}de!==5&&(de=2),a=Ia(a,l),p=s;do{switch(p.tag){case 3:o=a,p.flags|=4096,e&=-e,p.lanes|=e;var O=Ah(p,o,e);Wu(p,O);break e;case 1:o=a;var C=p.type,P=p.stateNode;if((p.flags&64)===0&&(typeof C.getDerivedStateFromError=="function"||P!==null&&typeof P.componentDidCatch=="function"&&(rt===null||!rt.has(P)))){p.flags|=4096,e&=-e,p.lanes|=e;var L=_h(p,o,e);Wu(p,L);break e}}p=p.return}while(p!==null)}Hh(n)}catch(R){e=R,ne===n&&n!==null&&(ne=n=n.return);continue}break}while(1)}function zh(){var t=Ro.current;return Ro.current=Oo,t===null?Oo:t}function Li(t,e){var n=A;A|=16;var i=zh();Ce===t&&ge===e||zn(t,e);do try{Dm();break}catch(r){Mh(t,r)}while(1);if(ya(),A=n,Ro.current=i,ne!==null)throw Error(x(261));return Ce=null,ge=0,de}function Dm(){for(;ne!==null;)Vh(ne)}function Am(){for(;ne!==null&&!pm();)Vh(ne)}function Vh(t){var e=Uh(t.alternate,t,un);t.memoizedProps=t.pendingProps,e===null?Hh(t):ne=e,Oa.current=null}function Hh(t){var e=t;do{var n=e.alternate;if(t=e.return,(e.flags&2048)===0){if(n=Cm(n,e,un),n!==null){ne=n;return}if(n=e,n.tag!==24&&n.tag!==23||n.memoizedState===null||(un&1073741824)!==0||(n.mode&4)===0){for(var i=0,r=n.child;r!==null;)i|=r.lanes|r.childLanes,r=r.sibling;n.childLanes=i}t!==null&&(t.flags&2048)===0&&(t.firstEffect===null&&(t.firstEffect=e.firstEffect),e.lastEffect!==null&&(t.lastEffect!==null&&(t.lastEffect.nextEffect=e.firstEffect),t.lastEffect=e.lastEffect),1<e.flags&&(t.lastEffect!==null?t.lastEffect.nextEffect=e:t.firstEffect=e,t.lastEffect=e))}else{if(n=$m(e),n!==null){n.flags&=2047,ne=n;return}t!==null&&(t.firstEffect=t.lastEffect=null,t.flags|=2048)}if(e=e.sibling,e!==null){ne=e;return}ne=e=t}while(e!==null);de===0&&(de=5)}function Xt(t){var e=qn();return an(99,_m.bind(null,t,e)),null}function _m(t,e){do Ht();while(Wi!==null);if((A&48)!==0)throw Error(x(327));var n=t.finishedWork;if(n===null)return null;if(t.finishedWork=null,t.finishedLanes=0,n===t.current)throw Error(x(177));t.callbackNode=null;var i=n.lanes|n.childLanes,r=i,o=t.pendingLanes&~r;t.pendingLanes=r,t.suspendedLanes=0,t.pingedLanes=0,t.expiredLanes&=r,t.mutableReadLanes&=r,t.entangledLanes&=r,r=t.entanglements;for(var s=t.eventTimes,l=t.expirationTimes;0<o;){var a=31-Lt(o),u=1<<a;r[a]=0,s[a]=-1,l[a]=-1,o&=~u}if(pt!==null&&(i&24)===0&&pt.has(t)&&pt.delete(t),t===Ce&&(ne=Ce=null,ge=0),1<n.flags?n.lastEffect!==null?(n.lastEffect.nextEffect=n,i=n.firstEffect):i=n:i=n.firstEffect,i!==null){if(r=A,A|=32,Oa.current=null,ks=Zr,s=Pu(),cl(s)){if("selectionStart"in s)l={start:s.selectionStart,end:s.selectionEnd};else e:if(l=(l=s.ownerDocument)&&l.defaultView||window,(u=l.getSelection&&l.getSelection())&&u.rangeCount!==0){l=u.anchorNode,o=u.anchorOffset,a=u.focusNode,u=u.focusOffset;try{l.nodeType,a.nodeType}catch{l=null;break e}var h=0,g=-1,p=-1,w=0,k=0,$=s,f=null;t:for(;;){for(var c;$!==l||o!==0&&$.nodeType!==3||(g=h+o),$!==a||u!==0&&$.nodeType!==3||(p=h+u),$.nodeType===3&&(h+=$.nodeValue.length),(c=$.firstChild)!==null;)f=$,$=c;for(;;){if($===s)break t;if(f===l&&++w===o&&(g=h),f===a&&++k===u&&(p=h),(c=$.nextSibling)!==null)break;$=f,f=$.parentNode}$=c}l=g===-1||p===-1?null:{start:g,end:p}}else l=null;l=l||{start:0,end:0}}else l=null;Cs={focusedElem:s,selectionRange:l},Zr=!1,qi=null,ro=!1,T=i;do try{Lm()}catch(R){if(T===null)throw Error(x(330));Dt(T,R),T=T.nextEffect}while(T!==null);qi=null,T=i;do try{for(s=t;T!==null;){var d=T.flags;if(d&16&&Ki(T.stateNode,""),d&128){var v=T.alternate;if(v!==null){var y=v.ref;y!==null&&(typeof y=="function"?y(null):y.current=null)}}switch(d&1038){case 2:gc(T),T.flags&=-3;break;case 6:gc(T),T.flags&=-3,Rs(T.alternate,T);break;case 1024:T.flags&=-1025;break;case 1028:T.flags&=-1025,Rs(T.alternate,T);break;case 4:Rs(T.alternate,T);break;case 8:l=T,Lh(s,l);var O=l.alternate;pc(l),O!==null&&pc(O)}T=T.nextEffect}}catch(R){if(T===null)throw Error(x(330));Dt(T,R),T=T.nextEffect}while(T!==null);if(y=Cs,v=Pu(),d=y.focusedElem,s=y.selectionRange,v!==d&&d&&d.ownerDocument&&Kd(d.ownerDocument.documentElement,d)){for(s!==null&&cl(d)&&(v=s.start,y=s.end,y===void 0&&(y=v),"selectionStart"in d?(d.selectionStart=v,d.selectionEnd=Math.min(y,d.value.length)):(y=(v=d.ownerDocument||document)&&v.defaultView||window,y.getSelection&&(y=y.getSelection(),l=d.textContent.length,O=Math.min(s.start,l),s=s.end===void 0?O:Math.min(s.end,l),!y.extend&&O>s&&(l=s,s=O,O=l),l=Ru(d,O),o=Ru(d,s),l&&o&&(y.rangeCount!==1||y.anchorNode!==l.node||y.anchorOffset!==l.offset||y.focusNode!==o.node||y.focusOffset!==o.offset)&&(v=v.createRange(),v.setStart(l.node,l.offset),y.removeAllRanges(),O>s?(y.addRange(v),y.extend(o.node,o.offset)):(v.setEnd(o.node,o.offset),y.addRange(v)))))),v=[],y=d;y=y.parentNode;)y.nodeType===1&&v.push({element:y,left:y.scrollLeft,top:y.scrollTop});for(typeof d.focus=="function"&&d.focus(),d=0;d<v.length;d++)y=v[d],y.element.scrollLeft=y.left,y.element.scrollTop=y.top}Zr=!!ks,Cs=ks=null,t.current=n,T=i;do try{for(d=t;T!==null;){var C=T.flags;if(C&36&&Im(d,T.alternate,T),C&128){v=void 0;var P=T.ref;if(P!==null){var L=T.stateNode;switch(T.tag){case 5:v=L;break;default:v=L}typeof P=="function"?P(v):P.current=v}}T=T.nextEffect}}catch(R){if(T===null)throw Error(x(330));Dt(T,R),T=T.nextEffect}while(T!==null);T=null,gm(),A=r}else t.current=n;if(Ft)Ft=!1,Wi=t,_i=e;else for(T=i;T!==null;)e=T.nextEffect,T.nextEffect=null,T.flags&8&&(C=T,C.sibling=null,C.stateNode=null),T=e;if(i=t.pendingLanes,i===0&&(rt=null),i===1?t===Al?Qi++:(Qi=0,Al=t):Qi=0,n=n.stateNode,on&&typeof on.onCommitFiberRoot=="function")try{on.onCommitFiberRoot(ga,n,void 0,(n.current.flags&64)===64)}catch{}if(We(t,me()),Po)throw Po=!1,t=Rl,Rl=null,t;return(A&8)!==0||lt(),null}function Lm(){for(;T!==null;){var t=T.alternate;ro||qi===null||((T.flags&8)!==0?gu(T,qi)&&(ro=!0):T.tag===13&&Om(t,T)&&gu(T,qi)&&(ro=!0));var e=T.flags;(e&256)!==0&&Tm(t,T),(e&512)===0||Ft||(Ft=!0,lr(97,function(){return Ht(),null})),T=T.nextEffect}}function Ht(){if(_i!==90){var t=97<_i?97:_i;return _i=90,an(t,Fm)}return!1}function Nm(t,e){Pl.push(e,t),Ft||(Ft=!0,lr(97,function(){return Ht(),null}))}function jh(t,e){Dl.push(e,t),Ft||(Ft=!0,lr(97,function(){return Ht(),null}))}function Fm(){if(Wi===null)return!1;var t=Wi;if(Wi=null,(A&48)!==0)throw Error(x(331));var e=A;A|=32;var n=Dl;Dl=[];for(var i=0;i<n.length;i+=2){var r=n[i],o=n[i+1],s=r.destroy;if(r.destroy=void 0,typeof s=="function")try{s()}catch(a){if(o===null)throw Error(x(330));Dt(o,a)}}for(n=Pl,Pl=[],i=0;i<n.length;i+=2){r=n[i],o=n[i+1];try{var l=r.create;r.destroy=l()}catch(a){if(o===null)throw Error(x(330));Dt(o,a)}}for(l=t.current.firstEffect;l!==null;)t=l.nextEffect,l.nextEffect=null,l.flags&8&&(l.sibling=null,l.stateNode=null),l=t;return A=e,lt(),!0}function yc(t,e,n){e=Ia(n,e),e=Ah(t,e,1),Ot(t,e),e=Ne(),t=Zo(t,1),t!==null&&(jo(t,1,e),We(t,e))}function Dt(t,e){if(t.tag===3)yc(t,t,e);else for(var n=t.return;n!==null;){if(n.tag===3){yc(n,t,e);break}else if(n.tag===1){var i=n.stateNode;if(typeof n.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(rt===null||!rt.has(i))){t=Ia(e,t);var r=_h(n,t,1);if(Ot(n,r),r=Ne(),n=Zo(n,1),n!==null)jo(n,1,r),We(n,r);else if(typeof i.componentDidCatch=="function"&&(rt===null||!rt.has(i)))try{i.componentDidCatch(e,t)}catch{}break}}n=n.return}}function Bm(t,e,n){var i=t.pingCache;i!==null&&i.delete(e),e=Ne(),t.pingedLanes|=t.suspendedLanes&n,Ce===t&&(ge&n)===n&&(de===4||de===3&&(ge&62914560)===ge&&500>me()-Pa?zn(t,0):Ra|=n),We(t,e)}function Mm(t,e){var n=t.stateNode;n!==null&&n.delete(e),e=0,e===0&&(e=t.mode,(e&2)===0?e=1:(e&4)===0?e=qn()===99?1:2:(ct===0&&(ct=ni),e=kn(62914560&~ct),e===0&&(e=4194304))),n=Ne(),t=Zo(t,e),t!==null&&(jo(t,e,n),We(t,n))}var Uh;Uh=function(t,e,n){var i=e.lanes;if(t!==null)if(t.memoizedProps!==e.pendingProps||Pe.current)Je=!0;else if((n&i)!==0)Je=(t.flags&16384)!==0;else{switch(Je=!1,e.tag){case 3:rc(e),Ts();break;case 5:Yu(e);break;case 1:De(e.type)&&eo(e);break;case 4:yl(e,e.stateNode.containerInfo);break;case 10:i=e.memoizedProps.value;var r=e.type._context;J(bo,r._currentValue),r._currentValue=i;break;case 13:if(e.memoizedState!==null)return(n&e.child.childLanes)!==0?oc(t,e,n):(J(Z,Z.current&1),e=ht(t,e,n),e!==null?e.sibling:null);J(Z,Z.current&1);break;case 19:if(i=(n&e.childLanes)!==0,(t.flags&64)!==0){if(i)return cc(t,e,n);e.flags|=64}if(r=e.memoizedState,r!==null&&(r.rendering=null,r.tail=null,r.lastEffect=null),J(Z,Z.current),i)break;return null;case 23:case 24:return e.lanes=0,Is(t,e,n)}return ht(t,e,n)}else Je=!1;switch(e.lanes=0,e.tag){case 2:if(i=e.type,t!==null&&(t.alternate=null,e.alternate=null,e.flags|=2),t=e.pendingProps,r=Qn(e,ye.current),Fn(e,n),r=$a(null,e,i,t,r,n),e.flags|=1,typeof r=="object"&&r!==null&&typeof r.render=="function"&&r.$$typeof===void 0){if(e.tag=1,e.memoizedState=null,e.updateQueue=null,De(i)){var o=!0;eo(e)}else o=!1;e.memoizedState=r.state!==null&&r.state!==void 0?r.state:null,wa(e);var s=i.getDerivedStateFromProps;typeof s=="function"&&ko(e,i,s,t),r.updater=Yo,e.stateNode=r,r._reactInternals=e,vl(e,i,t,n),e=kl(null,e,i,!0,o,n)}else e.tag=0,Re(null,e,r,n),e=e.child;return e;case 16:r=e.elementType;e:{switch(t!==null&&(t.alternate=null,e.alternate=null,e.flags|=2),t=e.pendingProps,o=r._init,r=o(r._payload),e.type=r,o=e.tag=Vm(r),t=Xe(r,t),o){case 0:e=xl(null,e,r,t,n);break e;case 1:e=ic(null,e,r,t,n);break e;case 11:e=tc(null,e,r,t,n);break e;case 14:e=nc(null,e,r,Xe(r.type,t),i,n);break e}throw Error(x(306,r,""))}return e;case 0:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:Xe(i,r),xl(t,e,i,r,n);case 1:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:Xe(i,r),ic(t,e,i,r,n);case 3:if(rc(e),i=e.updateQueue,t===null||i===null)throw Error(x(282));if(i=e.pendingProps,r=e.memoizedState,r=r!==null?r.element:null,mh(t,e),ar(e,i,null,n),i=e.memoizedState.element,i===r)Ts(),e=ht(t,e,n);else{if(r=e.stateNode,(o=r.hydrate)&&($t=Nn(e.stateNode.containerInfo.firstChild),dt=e,o=st=!0),o){if(t=r.mutableSourceEagerHydrationData,t!=null)for(r=0;r<t.length;r+=2)o=t[r],o._workInProgressVersionPrimary=t[r+1],Bn.push(o);for(n=bh(e,null,i,n),e.child=n;n;)n.flags=n.flags&-3|1024,n=n.sibling}else Re(t,e,i,n),Ts();e=e.child}return e;case 5:return Yu(e),t===null&&bl(e),i=e.type,r=e.pendingProps,o=t!==null?t.memoizedProps:null,s=r.children,fl(i,r)?s=null:o!==null&&fl(i,o)&&(e.flags|=16),Oh(t,e),Re(t,e,s,n),e.child;case 6:return t===null&&bl(e),null;case 13:return oc(t,e,n);case 4:return yl(e,e.stateNode.containerInfo),i=e.pendingProps,t===null?e.child=Co(e,null,i,n):Re(t,e,i,n),e.child;case 11:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:Xe(i,r),tc(t,e,i,r,n);case 7:return Re(t,e,e.pendingProps,n),e.child;case 8:return Re(t,e,e.pendingProps.children,n),e.child;case 12:return Re(t,e,e.pendingProps.children,n),e.child;case 10:e:{i=e.type._context,r=e.pendingProps,s=e.memoizedProps,o=r.value;var l=e.type._context;if(J(bo,l._currentValue),l._currentValue=o,s!==null)if(l=s.value,o=Ve(l,o)?0:(typeof i._calculateChangedBits=="function"?i._calculateChangedBits(l,o):1073741823)|0,o===0){if(s.children===r.children&&!Pe.current){e=ht(t,e,n);break e}}else for(l=e.child,l!==null&&(l.return=e);l!==null;){var a=l.dependencies;if(a!==null){s=l.child;for(var u=a.firstContext;u!==null;){if(u.context===i&&(u.observedBits&o)!==0){l.tag===1&&(u=It(-1,n&-n),u.tag=2,Ot(l,u)),l.lanes|=n,u=l.alternate,u!==null&&(u.lanes|=n),ph(l.return,n),a.lanes|=n;break}u=u.next}}else s=l.tag===10&&l.type===e.type?null:l.child;if(s!==null)s.return=l;else for(s=l;s!==null;){if(s===e){s=null;break}if(l=s.sibling,l!==null){l.return=s.return,s=l;break}s=s.return}l=s}Re(t,e,r.children,n),e=e.child}return e;case 9:return r=e.type,o=e.pendingProps,i=o.children,Fn(e,n),r=Ue(r,o.unstable_observedBits),i=i(r),e.flags|=1,Re(t,e,i,n),e.child;case 14:return r=e.type,o=Xe(r,e.pendingProps),o=Xe(r.type,o),nc(t,e,r,o,i,n);case 15:return Ih(t,e,e.type,e.pendingProps,i,n);case 17:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:Xe(i,r),t!==null&&(t.alternate=null,e.alternate=null,e.flags|=2),e.tag=1,De(i)?(t=!0,eo(e)):t=!1,Fn(e,n),vh(e,i,r),vl(e,i,r,n),kl(null,e,i,!0,t,n);case 19:return cc(t,e,n);case 23:return Is(t,e,n);case 24:return Is(t,e,n)}throw Error(x(156,e.tag))};function zm(t,e,n,i){this.tag=t,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=e,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.flags=0,this.lastEffect=this.firstEffect=this.nextEffect=null,this.childLanes=this.lanes=0,this.alternate=null}function He(t,e,n,i){return new zm(t,e,n,i)}function Aa(t){return t=t.prototype,!(!t||!t.isReactComponent)}function Vm(t){if(typeof t=="function")return Aa(t)?1:0;if(t!=null){if(t=t.$$typeof,t===zo)return 11;if(t===Vo)return 14}return 2}function Bt(t,e){var n=t.alternate;return n===null?(n=He(t.tag,e,t.key,t.mode),n.elementType=t.elementType,n.type=t.type,n.stateNode=t.stateNode,n.alternate=t,t.alternate=n):(n.pendingProps=e,n.type=t.type,n.flags=0,n.nextEffect=null,n.firstEffect=null,n.lastEffect=null),n.childLanes=t.childLanes,n.lanes=t.lanes,n.child=t.child,n.memoizedProps=t.memoizedProps,n.memoizedState=t.memoizedState,n.updateQueue=t.updateQueue,e=t.dependencies,n.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext},n.sibling=t.sibling,n.index=t.index,n.ref=t.ref,n}function oo(t,e,n,i,r,o){var s=2;if(i=t,typeof t=="function")Aa(t)&&(s=1);else if(typeof t=="string")s=5;else e:switch(t){case xt:return Vn(n.children,r,o,e);case wd:s=8,r|=16;break;case Yl:s=8,r|=1;break;case Ni:return t=He(12,n,e,r|8),t.elementType=Ni,t.type=Ni,t.lanes=o,t;case Fi:return t=He(13,n,e,r),t.type=Fi,t.elementType=Fi,t.lanes=o,t;case uo:return t=He(19,n,e,r),t.elementType=uo,t.lanes=o,t;case ta:return _a(n,r,o,e);case Ys:return t=He(24,n,e,r),t.elementType=Ys,t.lanes=o,t;default:if(typeof t=="object"&&t!==null)switch(t.$$typeof){case Xl:s=10;break e;case Zl:s=9;break e;case zo:s=11;break e;case Vo:s=14;break e;case Jl:s=16,i=null;break e;case Kl:s=22;break e}throw Error(x(130,t==null?t:typeof t,""))}return e=He(s,n,e,r),e.elementType=t,e.type=i,e.lanes=o,e}function Vn(t,e,n,i){return t=He(7,t,i,e),t.lanes=n,t}function _a(t,e,n,i){return t=He(23,t,i,e),t.elementType=ta,t.lanes=n,t}function Ps(t,e,n){return t=He(6,t,null,e),t.lanes=n,t}function Ds(t,e,n){return e=He(4,t.children!==null?t.children:[],t.key,e),e.lanes=n,e.stateNode={containerInfo:t.containerInfo,pendingChildren:null,implementation:t.implementation},e}function Hm(t,e,n){this.tag=e,this.containerInfo=t,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.pendingContext=this.context=null,this.hydrate=n,this.callbackNode=null,this.callbackPriority=0,this.eventTimes=ms(0),this.expirationTimes=ms(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=ms(0),this.mutableSourceEagerHydrationData=null}function jm(t,e,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:Jt,key:i==null?null:""+i,children:t,containerInfo:e,implementation:n}}function Do(t,e,n,i){var r=e.current,o=Ne(),s=Rt(r);e:if(n){n=n._reactInternals;t:{if(fn(n)!==n||n.tag!==1)throw Error(x(170));var l=n;do{switch(l.tag){case 3:l=l.stateNode.context;break t;case 1:if(De(l.type)){l=l.stateNode.__reactInternalMemoizedMergedChildContext;break t}}l=l.return}while(l!==null);throw Error(x(171))}if(n.tag===1){var a=n.type;if(De(a)){n=lh(n,a,l);break e}}n=l}else n=Nt;return e.context===null?e.context=n:e.pendingContext=n,e=It(o,s),e.payload={element:t},i=i===void 0?null:i,i!==null&&(e.callback=i),Ot(r,e),Pt(r,s,o),s}function As(t){if(t=t.current,!t.child)return null;switch(t.child.tag){case 5:return t.child.stateNode;default:return t.child.stateNode}}function bc(t,e){if(t=t.memoizedState,t!==null&&t.dehydrated!==null){var n=t.retryLane;t.retryLane=n!==0&&n<e?n:e}}function La(t,e){bc(t,e),(t=t.alternate)&&bc(t,e)}function Um(){return null}function Na(t,e,n){var i=n!=null&&n.hydrationOptions!=null&&n.hydrationOptions.mutableSources||null;if(n=new Hm(t,e,n!=null&&n.hydrate===!0),e=He(3,null,null,e===2?7:e===1?3:0),n.current=e,e.stateNode=n,wa(e),t[ti]=n.current,nh(t.nodeType===8?t.parentNode:t),i)for(t=0;t<i.length;t++){e=i[t];var r=e._getVersion;r=r(e._source),n.mutableSourceEagerHydrationData==null?n.mutableSourceEagerHydrationData=[e,r]:n.mutableSourceEagerHydrationData.push(e,r)}this._internalRoot=n}Na.prototype.render=function(t){Do(t,this._internalRoot,null,null)};Na.prototype.unmount=function(){var t=this._internalRoot,e=t.containerInfo;Do(null,t,null,function(){e[ti]=null})};function kr(t){return!(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11&&(t.nodeType!==8||t.nodeValue!==" react-mount-point-unstable "))}function Wm(t,e){if(e||(e=t?t.nodeType===9?t.documentElement:t.firstChild:null,e=!(!e||e.nodeType!==1||!e.hasAttribute("data-reactroot"))),!e)for(var n;n=t.lastChild;)t.removeChild(n);return new Na(t,0,e?{hydrate:!0}:void 0)}function Jo(t,e,n,i,r){var o=n._reactRootContainer;if(o){var s=o._internalRoot;if(typeof r=="function"){var l=r;r=function(){var u=As(s);l.call(u)}}Do(e,s,t,r)}else{if(o=n._reactRootContainer=Wm(n,i),s=o._internalRoot,typeof r=="function"){var a=r;r=function(){var u=As(s);a.call(u)}}Bh(function(){Do(e,s,t,r)})}return As(s)}Ld=function(t){if(t.tag===13){var e=Ne();Pt(t,4,e),La(t,4)}};sa=function(t){if(t.tag===13){var e=Ne();Pt(t,67108864,e),La(t,67108864)}};Nd=function(t){if(t.tag===13){var e=Ne(),n=Rt(t);Pt(t,n,e),La(t,n)}};Fd=function(t,e){return e()};ol=function(t,e,n){switch(e){case"input":if(Zs(t,n),e=n.name,n.type==="radio"&&e!=null){for(n=t;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+e)+'][type="radio"]'),e=0;e<n.length;e++){var i=n[e];if(i!==t&&i.form===t.form){var r=qo(i);if(!r)throw Error(x(90));kd(i),Zs(i,r)}}}break;case"textarea":$d(t,n);break;case"select":e=n.value,e!=null&&An(t,!!n.multiple,e,!1)}};ia=Fh;Pd=function(t,e,n,i,r){var o=A;A|=4;try{return an(98,t.bind(null,e,n,i,r))}finally{A=o,A===0&&(ri(),lt())}};ra=function(){(A&49)===0&&(Pm(),Ht())};Dd=function(t,e){var n=A;A|=2;try{return t(e)}finally{A=n,A===0&&(ri(),lt())}};function Wh(t,e){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!kr(e))throw Error(x(200));return jm(t,e,null,n)}var Qm={Events:[br,Tn,qo,Od,Rd,Ht,{current:!1}]},Si={findFiberByHostInstance:en,bundleType:0,version:"17.0.2",rendererPackageName:"react-dom"},qm={bundleType:Si.bundleType,version:Si.version,rendererPackageName:Si.rendererPackageName,rendererConfig:Si.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:hn.ReactCurrentDispatcher,findHostInstanceByFiber:function(t){return t=_d(t),t===null?null:t.stateNode},findFiberByHostInstance:Si.findFiberByHostInstance||Um,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__!="undefined"){var Vr=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Vr.isDisabled&&Vr.supportsFiber)try{ga=Vr.inject(qm),on=Vr}catch{}}qe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Qm;qe.createPortal=Wh;qe.findDOMNode=function(t){if(t==null)return null;if(t.nodeType===1)return t;var e=t._reactInternals;if(e===void 0)throw typeof t.render=="function"?Error(x(188)):Error(x(268,Object.keys(t)));return t=_d(e),t=t===null?null:t.stateNode,t};qe.flushSync=function(t,e){var n=A;if((n&48)!==0)return t(e);A|=1;try{if(t)return an(99,t.bind(null,e))}finally{A=n,lt()}};qe.hydrate=function(t,e,n){if(!kr(e))throw Error(x(200));return Jo(null,t,e,!0,n)};qe.render=function(t,e,n){if(!kr(e))throw Error(x(200));return Jo(null,t,e,!1,n)};qe.unmountComponentAtNode=function(t){if(!kr(t))throw Error(x(40));return t._reactRootContainer?(Bh(function(){Jo(null,null,t,!1,function(){t._reactRootContainer=null,t[ti]=null})}),!0):!1};qe.unstable_batchedUpdates=Fh;qe.unstable_createPortal=function(t,e){return Wh(t,e,2<arguments.length&&arguments[2]!==void 0?arguments[2]:null)};qe.unstable_renderSubtreeIntoContainer=function(t,e,n,i){if(!kr(n))throw Error(x(200));if(t==null||t._reactInternals===void 0)throw Error(x(38));return Jo(t,e,n,!1,i)};qe.version="17.0.2";function Qh(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__=="undefined"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Qh)}catch(t){console.error(t)}}Qh(),gd.exports=qe;var Gm=gd.exports;class Ym{constructor(){nu(this,"vsCodeApi");typeof acquireVsCodeApi=="function"&&(this.vsCodeApi=acquireVsCodeApi())}postMessage(e){this.vsCodeApi?this.vsCodeApi.postMessage(e):console.log(e)}getState(){if(this.vsCodeApi)return this.vsCodeApi.getState();{const e=localStorage.getItem("vscodeState");return e?JSON.parse(e):void 0}}setState(e){return this.vsCodeApi?this.vsCodeApi.setState(e):(localStorage.setItem("vscodeState",JSON.stringify(e)),e)}}const Xm=new Ym,Mt=function(){if(typeof globalThis!="undefined")return globalThis;if(typeof global!="undefined")return global;if(typeof self!="undefined")return self;if(typeof window!="undefined")return window;try{return new Function("return this")()}catch{return{}}}();Mt.trustedTypes===void 0&&(Mt.trustedTypes={createPolicy:(t,e)=>e});const qh={configurable:!1,enumerable:!1,writable:!1};Mt.FAST===void 0&&Reflect.defineProperty(Mt,"FAST",Object.assign({value:Object.create(null)},qh));const hr=Mt.FAST;if(hr.getById===void 0){const t=Object.create(null);Reflect.defineProperty(hr,"getById",Object.assign({value(e,n){let i=t[e];return i===void 0&&(i=n?t[e]=n():null),i}},qh))}const sn=Object.freeze([]);function Gh(){const t=new WeakMap;return function(e){let n=t.get(e);if(n===void 0){let i=Reflect.getPrototypeOf(e);for(;n===void 0&&i!==null;)n=t.get(i),i=Reflect.getPrototypeOf(i);n=n===void 0?[]:n.slice(0),t.set(e,n)}return n}}const _s=Mt.FAST.getById(1,()=>{const t=[],e=[];function n(){if(e.length)throw e.shift()}function i(s){try{s.call()}catch(l){e.push(l),setTimeout(n,0)}}function r(){let l=0;for(;l<t.length;)if(i(t[l]),l++,l>1024){for(let a=0,u=t.length-l;a<u;a++)t[a]=t[a+l];t.length-=l,l=0}t.length=0}function o(s){t.length<1&&Mt.requestAnimationFrame(r),t.push(s)}return Object.freeze({enqueue:o,process:r})}),Yh=Mt.trustedTypes.createPolicy("fast-html",{createHTML:t=>t});let Ls=Yh;const Gi=`fast-${Math.random().toString(36).substring(2,8)}`,Xh=`${Gi}{`,Fa=`}${Gi}`,B=Object.freeze({supportsAdoptedStyleSheets:Array.isArray(document.adoptedStyleSheets)&&"replace"in CSSStyleSheet.prototype,setHTMLPolicy(t){if(Ls!==Yh)throw new Error("The HTML policy can only be set once.");Ls=t},createHTML(t){return Ls.createHTML(t)},isMarker(t){return t&&t.nodeType===8&&t.data.startsWith(Gi)},extractDirectiveIndexFromMarker(t){return parseInt(t.data.replace(`${Gi}:`,""))},createInterpolationPlaceholder(t){return`${Xh}${t}${Fa}`},createCustomAttributePlaceholder(t,e){return`${t}="${this.createInterpolationPlaceholder(e)}"`},createBlockPlaceholder(t){return`<!--${Gi}:${t}-->`},queueUpdate:_s.enqueue,processUpdates:_s.process,nextUpdate(){return new Promise(_s.enqueue)},setAttribute(t,e,n){n==null?t.removeAttribute(e):t.setAttribute(e,n)},setBooleanAttribute(t,e,n){n?t.setAttribute(e,""):t.removeAttribute(e)},removeChildNodes(t){for(let e=t.firstChild;e!==null;e=t.firstChild)t.removeChild(e)},createTemplateWalker(t){return document.createTreeWalker(t,133,null,!1)}});class Ao{constructor(e,n){this.sub1=void 0,this.sub2=void 0,this.spillover=void 0,this.source=e,this.sub1=n}has(e){return this.spillover===void 0?this.sub1===e||this.sub2===e:this.spillover.indexOf(e)!==-1}subscribe(e){const n=this.spillover;if(n===void 0){if(this.has(e))return;if(this.sub1===void 0){this.sub1=e;return}if(this.sub2===void 0){this.sub2=e;return}this.spillover=[this.sub1,this.sub2,e],this.sub1=void 0,this.sub2=void 0}else n.indexOf(e)===-1&&n.push(e)}unsubscribe(e){const n=this.spillover;if(n===void 0)this.sub1===e?this.sub1=void 0:this.sub2===e&&(this.sub2=void 0);else{const i=n.indexOf(e);i!==-1&&n.splice(i,1)}}notify(e){const n=this.spillover,i=this.source;if(n===void 0){const r=this.sub1,o=this.sub2;r!==void 0&&r.handleChange(i,e),o!==void 0&&o.handleChange(i,e)}else for(let r=0,o=n.length;r<o;++r)n[r].handleChange(i,e)}}class Zh{constructor(e){this.subscribers={},this.sourceSubscribers=null,this.source=e}notify(e){var n;const i=this.subscribers[e];i!==void 0&&i.notify(e),(n=this.sourceSubscribers)===null||n===void 0||n.notify(e)}subscribe(e,n){var i;if(n){let r=this.subscribers[n];r===void 0&&(this.subscribers[n]=r=new Ao(this.source)),r.subscribe(e)}else this.sourceSubscribers=(i=this.sourceSubscribers)!==null&&i!==void 0?i:new Ao(this.source),this.sourceSubscribers.subscribe(e)}unsubscribe(e,n){var i;if(n){const r=this.subscribers[n];r!==void 0&&r.unsubscribe(e)}else(i=this.sourceSubscribers)===null||i===void 0||i.unsubscribe(e)}}const F=hr.getById(2,()=>{const t=/(:|&&|\|\||if)/,e=new WeakMap,n=B.queueUpdate;let i,r=u=>{throw new Error("Must call enableArrayObservation before observing arrays.")};function o(u){let h=u.$fastController||e.get(u);return h===void 0&&(Array.isArray(u)?h=r(u):e.set(u,h=new Zh(u))),h}const s=Gh();class l{constructor(h){this.name=h,this.field=`_${h}`,this.callback=`${h}Changed`}getValue(h){return i!==void 0&&i.watch(h,this.name),h[this.field]}setValue(h,g){const p=this.field,w=h[p];if(w!==g){h[p]=g;const k=h[this.callback];typeof k=="function"&&k.call(h,w,g),o(h).notify(this.name)}}}class a extends Ao{constructor(h,g,p=!1){super(h,g),this.binding=h,this.isVolatileBinding=p,this.needsRefresh=!0,this.needsQueue=!0,this.first=this,this.last=null,this.propertySource=void 0,this.propertyName=void 0,this.notifier=void 0,this.next=void 0}observe(h,g){this.needsRefresh&&this.last!==null&&this.disconnect();const p=i;i=this.needsRefresh?this:void 0,this.needsRefresh=this.isVolatileBinding;const w=this.binding(h,g);return i=p,w}disconnect(){if(this.last!==null){let h=this.first;for(;h!==void 0;)h.notifier.unsubscribe(this,h.propertyName),h=h.next;this.last=null,this.needsRefresh=this.needsQueue=!0}}watch(h,g){const p=this.last,w=o(h),k=p===null?this.first:{};if(k.propertySource=h,k.propertyName=g,k.notifier=w,w.subscribe(this,g),p!==null){if(!this.needsRefresh){let $;i=void 0,$=p.propertySource[p.propertyName],i=this,h===$&&(this.needsRefresh=!0)}p.next=k}this.last=k}handleChange(){this.needsQueue&&(this.needsQueue=!1,n(this))}call(){this.last!==null&&(this.needsQueue=!0,this.notify(this))}records(){let h=this.first;return{next:()=>{const g=h;return g===void 0?{value:void 0,done:!0}:(h=h.next,{value:g,done:!1})},[Symbol.iterator]:function(){return this}}}}return Object.freeze({setArrayObserverFactory(u){r=u},getNotifier:o,track(u,h){i!==void 0&&i.watch(u,h)},trackVolatile(){i!==void 0&&(i.needsRefresh=!0)},notify(u,h){o(u).notify(h)},defineProperty(u,h){typeof h=="string"&&(h=new l(h)),s(u).push(h),Reflect.defineProperty(u,h.name,{enumerable:!0,get:function(){return h.getValue(this)},set:function(g){h.setValue(this,g)}})},getAccessors:s,binding(u,h,g=this.isVolatileBinding(u)){return new a(u,h,g)},isVolatileBinding(u){return t.test(u.toString())}})});function I(t,e){F.defineProperty(t,e)}function Zm(t,e,n){return Object.assign({},n,{get:function(){return F.trackVolatile(),n.get.apply(this)}})}const wc=hr.getById(3,()=>{let t=null;return{get(){return t},set(e){t=e}}});class fr{constructor(){this.index=0,this.length=0,this.parent=null,this.parentContext=null}get event(){return wc.get()}get isEven(){return this.index%2===0}get isOdd(){return this.index%2!==0}get isFirst(){return this.index===0}get isInMiddle(){return!this.isFirst&&!this.isLast}get isLast(){return this.index===this.length-1}static setEvent(e){wc.set(e)}}F.defineProperty(fr.prototype,"index");F.defineProperty(fr.prototype,"length");const Yi=Object.seal(new fr);class Ko{constructor(){this.targetIndex=0}}class Jh extends Ko{constructor(){super(...arguments),this.createPlaceholder=B.createInterpolationPlaceholder}}class Ba extends Ko{constructor(e,n,i){super(),this.name=e,this.behavior=n,this.options=i}createPlaceholder(e){return B.createCustomAttributePlaceholder(this.name,e)}createBehavior(e){return new this.behavior(e,this.options)}}function Jm(t,e){this.source=t,this.context=e,this.bindingObserver===null&&(this.bindingObserver=F.binding(this.binding,this,this.isBindingVolatile)),this.updateTarget(this.bindingObserver.observe(t,e))}function Km(t,e){this.source=t,this.context=e,this.target.addEventListener(this.targetName,this)}function eg(){this.bindingObserver.disconnect(),this.source=null,this.context=null}function tg(){this.bindingObserver.disconnect(),this.source=null,this.context=null;const t=this.target.$fastView;t!==void 0&&t.isComposed&&(t.unbind(),t.needsBindOnly=!0)}function ng(){this.target.removeEventListener(this.targetName,this),this.source=null,this.context=null}function ig(t){B.setAttribute(this.target,this.targetName,t)}function rg(t){B.setBooleanAttribute(this.target,this.targetName,t)}function og(t){if(t==null&&(t=""),t.create){this.target.textContent="";let e=this.target.$fastView;e===void 0?e=t.create():this.target.$fastTemplate!==t&&(e.isComposed&&(e.remove(),e.unbind()),e=t.create()),e.isComposed?e.needsBindOnly&&(e.needsBindOnly=!1,e.bind(this.source,this.context)):(e.isComposed=!0,e.bind(this.source,this.context),e.insertBefore(this.target),this.target.$fastView=e,this.target.$fastTemplate=t)}else{const e=this.target.$fastView;e!==void 0&&e.isComposed&&(e.isComposed=!1,e.remove(),e.needsBindOnly?e.needsBindOnly=!1:e.unbind()),this.target.textContent=t}}function sg(t){this.target[this.targetName]=t}function lg(t){const e=this.classVersions||Object.create(null),n=this.target;let i=this.version||0;if(t!=null&&t.length){const r=t.split(/\s+/);for(let o=0,s=r.length;o<s;++o){const l=r[o];l!==""&&(e[l]=i,n.classList.add(l))}}if(this.classVersions=e,this.version=i+1,i!==0){i-=1;for(const r in e)e[r]===i&&n.classList.remove(r)}}class Ma extends Jh{constructor(e){super(),this.binding=e,this.bind=Jm,this.unbind=eg,this.updateTarget=ig,this.isBindingVolatile=F.isVolatileBinding(this.binding)}get targetName(){return this.originalTargetName}set targetName(e){if(this.originalTargetName=e,e!==void 0)switch(e[0]){case":":if(this.cleanedTargetName=e.substr(1),this.updateTarget=sg,this.cleanedTargetName==="innerHTML"){const n=this.binding;this.binding=(i,r)=>B.createHTML(n(i,r))}break;case"?":this.cleanedTargetName=e.substr(1),this.updateTarget=rg;break;case"@":this.cleanedTargetName=e.substr(1),this.bind=Km,this.unbind=ng;break;default:this.cleanedTargetName=e,e==="class"&&(this.updateTarget=lg);break}}targetAtContent(){this.updateTarget=og,this.unbind=tg}createBehavior(e){return new ag(e,this.binding,this.isBindingVolatile,this.bind,this.unbind,this.updateTarget,this.cleanedTargetName)}}class ag{constructor(e,n,i,r,o,s,l){this.source=null,this.context=null,this.bindingObserver=null,this.target=e,this.binding=n,this.isBindingVolatile=i,this.bind=r,this.unbind=o,this.updateTarget=s,this.targetName=l}handleChange(){this.updateTarget(this.bindingObserver.observe(this.source,this.context))}handleEvent(e){fr.setEvent(e);const n=this.binding(this.source,this.context);fr.setEvent(null),n!==!0&&e.preventDefault()}}let Ns=null;class za{addFactory(e){e.targetIndex=this.targetIndex,this.behaviorFactories.push(e)}captureContentBinding(e){e.targetAtContent(),this.addFactory(e)}reset(){this.behaviorFactories=[],this.targetIndex=-1}release(){Ns=this}static borrow(e){const n=Ns||new za;return n.directives=e,n.reset(),Ns=null,n}}function ug(t){if(t.length===1)return t[0];let e;const n=t.length,i=t.map(s=>typeof s=="string"?()=>s:(e=s.targetName||e,s.binding)),r=(s,l)=>{let a="";for(let u=0;u<n;++u)a+=i[u](s,l);return a},o=new Ma(r);return o.targetName=e,o}const cg=Fa.length;function Kh(t,e){const n=e.split(Xh);if(n.length===1)return null;const i=[];for(let r=0,o=n.length;r<o;++r){const s=n[r],l=s.indexOf(Fa);let a;if(l===-1)a=s;else{const u=parseInt(s.substring(0,l));i.push(t.directives[u]),a=s.substring(l+cg)}a!==""&&i.push(a)}return i}function xc(t,e,n=!1){const i=e.attributes;for(let r=0,o=i.length;r<o;++r){const s=i[r],l=s.value,a=Kh(t,l);let u=null;a===null?n&&(u=new Ma(()=>l),u.targetName=s.name):u=ug(a),u!==null&&(e.removeAttributeNode(s),r--,o--,t.addFactory(u))}}function dg(t,e,n){const i=Kh(t,e.textContent);if(i!==null){let r=e;for(let o=0,s=i.length;o<s;++o){const l=i[o],a=o===0?e:r.parentNode.insertBefore(document.createTextNode(""),r.nextSibling);typeof l=="string"?a.textContent=l:(a.textContent=" ",t.captureContentBinding(l)),r=a,t.targetIndex++,a!==e&&n.nextNode()}t.targetIndex--}}function hg(t,e){const n=t.content;document.adoptNode(n);const i=za.borrow(e);xc(i,t,!0);const r=i.behaviorFactories;i.reset();const o=B.createTemplateWalker(n);let s;for(;s=o.nextNode();)switch(i.targetIndex++,s.nodeType){case 1:xc(i,s);break;case 3:dg(i,s,o);break;case 8:B.isMarker(s)&&i.addFactory(e[B.extractDirectiveIndexFromMarker(s)])}let l=0;(B.isMarker(n.firstChild)||n.childNodes.length===1&&e.length)&&(n.insertBefore(document.createComment(""),n.firstChild),l=-1);const a=i.behaviorFactories;return i.release(),{fragment:n,viewBehaviorFactories:a,hostBehaviorFactories:r,targetOffset:l}}const Fs=document.createRange();class ef{constructor(e,n){this.fragment=e,this.behaviors=n,this.source=null,this.context=null,this.firstChild=e.firstChild,this.lastChild=e.lastChild}appendTo(e){e.appendChild(this.fragment)}insertBefore(e){if(this.fragment.hasChildNodes())e.parentNode.insertBefore(this.fragment,e);else{const n=this.lastChild;if(e.previousSibling===n)return;const i=e.parentNode;let r=this.firstChild,o;for(;r!==n;)o=r.nextSibling,i.insertBefore(r,e),r=o;i.insertBefore(n,e)}}remove(){const e=this.fragment,n=this.lastChild;let i=this.firstChild,r;for(;i!==n;)r=i.nextSibling,e.appendChild(i),i=r;e.appendChild(n)}dispose(){const e=this.firstChild.parentNode,n=this.lastChild;let i=this.firstChild,r;for(;i!==n;)r=i.nextSibling,e.removeChild(i),i=r;e.removeChild(n);const o=this.behaviors,s=this.source;for(let l=0,a=o.length;l<a;++l)o[l].unbind(s)}bind(e,n){const i=this.behaviors;if(this.source!==e)if(this.source!==null){const r=this.source;this.source=e,this.context=n;for(let o=0,s=i.length;o<s;++o){const l=i[o];l.unbind(r),l.bind(e,n)}}else{this.source=e,this.context=n;for(let r=0,o=i.length;r<o;++r)i[r].bind(e,n)}}unbind(){if(this.source===null)return;const e=this.behaviors,n=this.source;for(let i=0,r=e.length;i<r;++i)e[i].unbind(n);this.source=null}static disposeContiguousBatch(e){if(e.length!==0){Fs.setStartBefore(e[0].firstChild),Fs.setEndAfter(e[e.length-1].lastChild),Fs.deleteContents();for(let n=0,i=e.length;n<i;++n){const r=e[n],o=r.behaviors,s=r.source;for(let l=0,a=o.length;l<a;++l)o[l].unbind(s)}}}}class kc{constructor(e,n){this.behaviorCount=0,this.hasHostBehaviors=!1,this.fragment=null,this.targetOffset=0,this.viewBehaviorFactories=null,this.hostBehaviorFactories=null,this.html=e,this.directives=n}create(e){if(this.fragment===null){let u;const h=this.html;if(typeof h=="string"){u=document.createElement("template"),u.innerHTML=B.createHTML(h);const p=u.content.firstElementChild;p!==null&&p.tagName==="TEMPLATE"&&(u=p)}else u=h;const g=hg(u,this.directives);this.fragment=g.fragment,this.viewBehaviorFactories=g.viewBehaviorFactories,this.hostBehaviorFactories=g.hostBehaviorFactories,this.targetOffset=g.targetOffset,this.behaviorCount=this.viewBehaviorFactories.length+this.hostBehaviorFactories.length,this.hasHostBehaviors=this.hostBehaviorFactories.length>0}const n=this.fragment.cloneNode(!0),i=this.viewBehaviorFactories,r=new Array(this.behaviorCount),o=B.createTemplateWalker(n);let s=0,l=this.targetOffset,a=o.nextNode();for(let u=i.length;s<u;++s){const h=i[s],g=h.targetIndex;for(;a!==null;)if(l===g){r[s]=h.createBehavior(a);break}else a=o.nextNode(),l++}if(this.hasHostBehaviors){const u=this.hostBehaviorFactories;for(let h=0,g=u.length;h<g;++h,++s)r[s]=u[h].createBehavior(e)}return new ef(n,r)}render(e,n,i){typeof n=="string"&&(n=document.getElementById(n)),i===void 0&&(i=n);const r=this.create(i);return r.bind(e,Yi),r.appendTo(n),r}}const fg=/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;function V(t,...e){const n=[];let i="";for(let r=0,o=t.length-1;r<o;++r){const s=t[r];let l=e[r];if(i+=s,l instanceof kc){const a=l;l=()=>a}if(typeof l=="function"&&(l=new Ma(l)),l instanceof Jh){const a=fg.exec(s);a!==null&&(l.targetName=a[2])}l instanceof Ko?(i+=l.createPlaceholder(n.length),n.push(l)):i+=l}return i+=t[t.length-1],new kc(i,n)}class Ae{constructor(){this.targets=new WeakSet}addStylesTo(e){this.targets.add(e)}removeStylesFrom(e){this.targets.delete(e)}isAttachedTo(e){return this.targets.has(e)}withBehaviors(...e){return this.behaviors=this.behaviors===null?e:this.behaviors.concat(e),this}}Ae.create=(()=>{if(B.supportsAdoptedStyleSheets){const t=new Map;return e=>new pg(e,t)}return t=>new vg(t)})();function Va(t){return t.map(e=>e instanceof Ae?Va(e.styles):[e]).reduce((e,n)=>e.concat(n),[])}function tf(t){return t.map(e=>e instanceof Ae?e.behaviors:null).reduce((e,n)=>n===null?e:(e===null&&(e=[]),e.concat(n)),null)}let nf=(t,e)=>{t.adoptedStyleSheets=[...t.adoptedStyleSheets,...e]},rf=(t,e)=>{t.adoptedStyleSheets=t.adoptedStyleSheets.filter(n=>e.indexOf(n)===-1)};if(B.supportsAdoptedStyleSheets)try{document.adoptedStyleSheets.push(),document.adoptedStyleSheets.splice(),nf=(t,e)=>{t.adoptedStyleSheets.push(...e)},rf=(t,e)=>{for(const n of e){const i=t.adoptedStyleSheets.indexOf(n);i!==-1&&t.adoptedStyleSheets.splice(i,1)}}}catch{}class pg extends Ae{constructor(e,n){super(),this.styles=e,this.styleSheetCache=n,this._styleSheets=void 0,this.behaviors=tf(e)}get styleSheets(){if(this._styleSheets===void 0){const e=this.styles,n=this.styleSheetCache;this._styleSheets=Va(e).map(i=>{if(i instanceof CSSStyleSheet)return i;let r=n.get(i);return r===void 0&&(r=new CSSStyleSheet,r.replaceSync(i),n.set(i,r)),r})}return this._styleSheets}addStylesTo(e){nf(e,this.styleSheets),super.addStylesTo(e)}removeStylesFrom(e){rf(e,this.styleSheets),super.removeStylesFrom(e)}}let mg=0;function gg(){return`fast-style-class-${++mg}`}class vg extends Ae{constructor(e){super(),this.styles=e,this.behaviors=null,this.behaviors=tf(e),this.styleSheets=Va(e),this.styleClass=gg()}addStylesTo(e){const n=this.styleSheets,i=this.styleClass;e=this.normalizeTarget(e);for(let r=0;r<n.length;r++){const o=document.createElement("style");o.innerHTML=n[r],o.className=i,e.append(o)}super.addStylesTo(e)}removeStylesFrom(e){e=this.normalizeTarget(e);const n=e.querySelectorAll(`.${this.styleClass}`);for(let i=0,r=n.length;i<r;++i)e.removeChild(n[i]);super.removeStylesFrom(e)}isAttachedTo(e){return super.isAttachedTo(this.normalizeTarget(e))}normalizeTarget(e){return e===document?document.body:e}}const _o=Object.freeze({locate:Gh()}),of={toView(t){return t?"true":"false"},fromView(t){return!(t==null||t==="false"||t===!1||t===0)}},Ke={toView(t){if(t==null)return null;const e=t*1;return isNaN(e)?null:e.toString()},fromView(t){if(t==null)return null;const e=t*1;return isNaN(e)?null:e}};class Lo{constructor(e,n,i=n.toLowerCase(),r="reflect",o){this.guards=new Set,this.Owner=e,this.name=n,this.attribute=i,this.mode=r,this.converter=o,this.fieldName=`_${n}`,this.callbackName=`${n}Changed`,this.hasCallback=this.callbackName in e.prototype,r==="boolean"&&o===void 0&&(this.converter=of)}setValue(e,n){const i=e[this.fieldName],r=this.converter;r!==void 0&&(n=r.fromView(n)),i!==n&&(e[this.fieldName]=n,this.tryReflectToAttribute(e),this.hasCallback&&e[this.callbackName](i,n),e.$fastController.notify(this.name))}getValue(e){return F.track(e,this.name),e[this.fieldName]}onAttributeChangedCallback(e,n){this.guards.has(e)||(this.guards.add(e),this.setValue(e,n),this.guards.delete(e))}tryReflectToAttribute(e){const n=this.mode,i=this.guards;i.has(e)||n==="fromView"||B.queueUpdate(()=>{i.add(e);const r=e[this.fieldName];switch(n){case"reflect":const o=this.converter;B.setAttribute(e,this.attribute,o!==void 0?o.toView(r):r);break;case"boolean":B.setBooleanAttribute(e,this.attribute,r);break}i.delete(e)})}static collect(e,...n){const i=[];n.push(_o.locate(e));for(let r=0,o=n.length;r<o;++r){const s=n[r];if(s!==void 0)for(let l=0,a=s.length;l<a;++l){const u=s[l];typeof u=="string"?i.push(new Lo(e,u)):i.push(new Lo(e,u.property,u.attribute,u.mode,u.converter))}}return i}}function b(t,e){let n;function i(r,o){arguments.length>1&&(n.property=o),_o.locate(r.constructor).push(n)}if(arguments.length>1){n={},i(t,e);return}return n=t===void 0?{}:t,i}const Cc={mode:"open"},$c={},Ll=hr.getById(4,()=>{const t=new Map;return Object.freeze({register(e){return t.has(e.type)?!1:(t.set(e.type,e),!0)},getByType(e){return t.get(e)}})});class Cr{constructor(e,n=e.definition){typeof n=="string"&&(n={name:n}),this.type=e,this.name=n.name,this.template=n.template;const i=Lo.collect(e,n.attributes),r=new Array(i.length),o={},s={};for(let l=0,a=i.length;l<a;++l){const u=i[l];r[l]=u.attribute,o[u.name]=u,s[u.attribute]=u}this.attributes=i,this.observedAttributes=r,this.propertyLookup=o,this.attributeLookup=s,this.shadowOptions=n.shadowOptions===void 0?Cc:n.shadowOptions===null?void 0:Object.assign(Object.assign({},Cc),n.shadowOptions),this.elementOptions=n.elementOptions===void 0?$c:Object.assign(Object.assign({},$c),n.elementOptions),this.styles=n.styles===void 0?void 0:Array.isArray(n.styles)?Ae.create(n.styles):n.styles instanceof Ae?n.styles:Ae.create([n.styles])}get isDefined(){return!!Ll.getByType(this.type)}define(e=customElements){const n=this.type;if(Ll.register(this)){const i=this.attributes,r=n.prototype;for(let o=0,s=i.length;o<s;++o)F.defineProperty(r,i[o]);Reflect.defineProperty(n,"observedAttributes",{value:this.observedAttributes,enumerable:!0})}return e.get(this.name)||e.define(this.name,n,this.elementOptions),this}}Cr.forType=Ll.getByType;const sf=new WeakMap,yg={bubbles:!0,composed:!0,cancelable:!0};function Bs(t){return t.shadowRoot||sf.get(t)||null}class Ha extends Zh{constructor(e,n){super(e),this.boundObservables=null,this.behaviors=null,this.needsInitialization=!0,this._template=null,this._styles=null,this._isConnected=!1,this.$fastController=this,this.view=null,this.element=e,this.definition=n;const i=n.shadowOptions;if(i!==void 0){const o=e.attachShadow(i);i.mode==="closed"&&sf.set(e,o)}const r=F.getAccessors(e);if(r.length>0){const o=this.boundObservables=Object.create(null);for(let s=0,l=r.length;s<l;++s){const a=r[s].name,u=e[a];u!==void 0&&(delete e[a],o[a]=u)}}}get isConnected(){return F.track(this,"isConnected"),this._isConnected}setIsConnected(e){this._isConnected=e,F.notify(this,"isConnected")}get template(){return this._template}set template(e){this._template!==e&&(this._template=e,this.needsInitialization||this.renderTemplate(e))}get styles(){return this._styles}set styles(e){this._styles!==e&&(this._styles!==null&&this.removeStyles(this._styles),this._styles=e,!this.needsInitialization&&e!==null&&this.addStyles(e))}addStyles(e){const n=Bs(this.element)||this.element.getRootNode();if(e instanceof HTMLStyleElement)n.append(e);else if(!e.isAttachedTo(n)){const i=e.behaviors;e.addStylesTo(n),i!==null&&this.addBehaviors(i)}}removeStyles(e){const n=Bs(this.element)||this.element.getRootNode();if(e instanceof HTMLStyleElement)n.removeChild(e);else if(e.isAttachedTo(n)){const i=e.behaviors;e.removeStylesFrom(n),i!==null&&this.removeBehaviors(i)}}addBehaviors(e){const n=this.behaviors||(this.behaviors=new Map),i=e.length,r=[];for(let o=0;o<i;++o){const s=e[o];n.has(s)?n.set(s,n.get(s)+1):(n.set(s,1),r.push(s))}if(this._isConnected){const o=this.element;for(let s=0;s<r.length;++s)r[s].bind(o,Yi)}}removeBehaviors(e,n=!1){const i=this.behaviors;if(i===null)return;const r=e.length,o=[];for(let s=0;s<r;++s){const l=e[s];if(i.has(l)){const a=i.get(l)-1;a===0||n?i.delete(l)&&o.push(l):i.set(l,a)}}if(this._isConnected){const s=this.element;for(let l=0;l<o.length;++l)o[l].unbind(s)}}onConnectedCallback(){if(this._isConnected)return;const e=this.element;this.needsInitialization?this.finishInitialization():this.view!==null&&this.view.bind(e,Yi);const n=this.behaviors;if(n!==null)for(const[i]of n)i.bind(e,Yi);this.setIsConnected(!0)}onDisconnectedCallback(){if(!this._isConnected)return;this.setIsConnected(!1);const e=this.view;e!==null&&e.unbind();const n=this.behaviors;if(n!==null){const i=this.element;for(const[r]of n)r.unbind(i)}}onAttributeChangedCallback(e,n,i){const r=this.definition.attributeLookup[e];r!==void 0&&r.onAttributeChangedCallback(this.element,i)}emit(e,n,i){return this._isConnected?this.element.dispatchEvent(new CustomEvent(e,Object.assign(Object.assign({detail:n},yg),i))):!1}finishInitialization(){const e=this.element,n=this.boundObservables;if(n!==null){const r=Object.keys(n);for(let o=0,s=r.length;o<s;++o){const l=r[o];e[l]=n[l]}this.boundObservables=null}const i=this.definition;this._template===null&&(this.element.resolveTemplate?this._template=this.element.resolveTemplate():i.template&&(this._template=i.template||null)),this._template!==null&&this.renderTemplate(this._template),this._styles===null&&(this.element.resolveStyles?this._styles=this.element.resolveStyles():i.styles&&(this._styles=i.styles||null)),this._styles!==null&&this.addStyles(this._styles),this.needsInitialization=!1}renderTemplate(e){const n=this.element,i=Bs(n)||n;this.view!==null?(this.view.dispose(),this.view=null):this.needsInitialization||B.removeChildNodes(i),e&&(this.view=e.render(n,i,n))}static forCustomElement(e){const n=e.$fastController;if(n!==void 0)return n;const i=Cr.forType(e.constructor);if(i===void 0)throw new Error("Missing FASTElement definition.");return e.$fastController=new Ha(e,i)}}function Sc(t){return class extends t{constructor(){super(),Ha.forCustomElement(this)}$emit(e,n,i){return this.$fastController.emit(e,n,i)}connectedCallback(){this.$fastController.onConnectedCallback()}disconnectedCallback(){this.$fastController.onDisconnectedCallback()}attributeChangedCallback(e,n,i){this.$fastController.onAttributeChangedCallback(e,n,i)}}}const es=Object.assign(Sc(HTMLElement),{from(t){return Sc(t)},define(t,e){return new Cr(t,e).define().type}});class lf{createCSS(){return""}createBehavior(){}}function bg(t,e){const n=[];let i="";const r=[];for(let o=0,s=t.length-1;o<s;++o){i+=t[o];let l=e[o];if(l instanceof lf){const a=l.createBehavior();l=l.createCSS(),a&&r.push(a)}l instanceof Ae||l instanceof CSSStyleSheet?(i.trim()!==""&&(n.push(i),i=""),n.push(l)):i+=l}return i+=t[t.length-1],i.trim()!==""&&n.push(i),{styles:n,behaviors:r}}function X(t,...e){const{styles:n,behaviors:i}=bg(t,e),r=Ae.create(n);return i.length&&r.withBehaviors(...i),r}function Ze(t,e,n){return{index:t,removed:e,addedCount:n}}const af=0,uf=1,Nl=2,Fl=3;function wg(t,e,n,i,r,o){const s=o-r+1,l=n-e+1,a=new Array(s);let u,h;for(let g=0;g<s;++g)a[g]=new Array(l),a[g][0]=g;for(let g=0;g<l;++g)a[0][g]=g;for(let g=1;g<s;++g)for(let p=1;p<l;++p)t[e+p-1]===i[r+g-1]?a[g][p]=a[g-1][p-1]:(u=a[g-1][p]+1,h=a[g][p-1]+1,a[g][p]=u<h?u:h);return a}function xg(t){let e=t.length-1,n=t[0].length-1,i=t[e][n];const r=[];for(;e>0||n>0;){if(e===0){r.push(Nl),n--;continue}if(n===0){r.push(Fl),e--;continue}const o=t[e-1][n-1],s=t[e-1][n],l=t[e][n-1];let a;s<l?a=s<o?s:o:a=l<o?l:o,a===o?(o===i?r.push(af):(r.push(uf),i=o),e--,n--):a===s?(r.push(Fl),e--,i=s):(r.push(Nl),n--,i=l)}return r.reverse(),r}function kg(t,e,n){for(let i=0;i<n;++i)if(t[i]!==e[i])return i;return n}function Cg(t,e,n){let i=t.length,r=e.length,o=0;for(;o<n&&t[--i]===e[--r];)o++;return o}function $g(t,e,n,i){return e<n||i<t?-1:e===n||i===t?0:t<n?e<i?e-n:i-n:i<e?i-t:e-t}function cf(t,e,n,i,r,o){let s=0,l=0;const a=Math.min(n-e,o-r);if(e===0&&r===0&&(s=kg(t,i,a)),n===t.length&&o===i.length&&(l=Cg(t,i,a-s)),e+=s,r+=s,n-=l,o-=l,n-e===0&&o-r===0)return sn;if(e===n){const k=Ze(e,[],0);for(;r<o;)k.removed.push(i[r++]);return[k]}else if(r===o)return[Ze(e,[],n-e)];const u=xg(wg(t,e,n,i,r,o)),h=[];let g,p=e,w=r;for(let k=0;k<u.length;++k)switch(u[k]){case af:g!==void 0&&(h.push(g),g=void 0),p++,w++;break;case uf:g===void 0&&(g=Ze(p,[],0)),g.addedCount++,p++,g.removed.push(i[w]),w++;break;case Nl:g===void 0&&(g=Ze(p,[],0)),g.addedCount++,p++;break;case Fl:g===void 0&&(g=Ze(p,[],0)),g.removed.push(i[w]),w++;break}return g!==void 0&&h.push(g),h}const Ec=Array.prototype.push;function Sg(t,e,n,i){const r=Ze(e,n,i);let o=!1,s=0;for(let l=0;l<t.length;l++){const a=t[l];if(a.index+=s,o)continue;const u=$g(r.index,r.index+r.removed.length,a.index,a.index+a.addedCount);if(u>=0){t.splice(l,1),l--,s-=a.addedCount-a.removed.length,r.addedCount+=a.addedCount-u;const h=r.removed.length+a.removed.length-u;if(!r.addedCount&&!h)o=!0;else{let g=a.removed;if(r.index<a.index){const p=r.removed.slice(0,a.index-r.index);Ec.apply(p,g),g=p}if(r.index+r.removed.length>a.index+a.addedCount){const p=r.removed.slice(a.index+a.addedCount-r.index);Ec.apply(g,p)}r.removed=g,a.index<r.index&&(r.index=a.index)}}else if(r.index<a.index){o=!0,t.splice(l,0,r),l++;const h=r.addedCount-r.removed.length;a.index+=h,s+=h}}o||t.push(r)}function Eg(t){const e=[];for(let n=0,i=t.length;n<i;n++){const r=t[n];Sg(e,r.index,r.removed,r.addedCount)}return e}function Tg(t,e){let n=[];const i=Eg(e);for(let r=0,o=i.length;r<o;++r){const s=i[r];if(s.addedCount===1&&s.removed.length===1){s.removed[0]!==t[s.index]&&n.push(s);continue}n=n.concat(cf(t,s.index,s.index+s.addedCount,s.removed,0,s.removed.length))}return n}let Tc=!1;function Ms(t,e){let n=t.index;const i=e.length;return n>i?n=i-t.addedCount:n<0&&(n=i+t.removed.length+n-t.addedCount),n<0&&(n=0),t.index=n,t}class Ig extends Ao{constructor(e){super(e),this.oldCollection=void 0,this.splices=void 0,this.needsQueue=!0,this.call=this.flush,Reflect.defineProperty(e,"$fastController",{value:this,enumerable:!1})}subscribe(e){this.flush(),super.subscribe(e)}addSplice(e){this.splices===void 0?this.splices=[e]:this.splices.push(e),this.needsQueue&&(this.needsQueue=!1,B.queueUpdate(this))}reset(e){this.oldCollection=e,this.needsQueue&&(this.needsQueue=!1,B.queueUpdate(this))}flush(){const e=this.splices,n=this.oldCollection;if(e===void 0&&n===void 0)return;this.needsQueue=!0,this.splices=void 0,this.oldCollection=void 0;const i=n===void 0?Tg(this.source,e):cf(this.source,0,this.source.length,n,0,n.length);this.notify(i)}}function Og(){if(Tc)return;Tc=!0,F.setArrayObserverFactory(a=>new Ig(a));const t=Array.prototype;if(t.$fastPatch)return;Reflect.defineProperty(t,"$fastPatch",{value:1,enumerable:!1});const e=t.pop,n=t.push,i=t.reverse,r=t.shift,o=t.sort,s=t.splice,l=t.unshift;t.pop=function(){const a=this.length>0,u=e.apply(this,arguments),h=this.$fastController;return h!==void 0&&a&&h.addSplice(Ze(this.length,[u],0)),u},t.push=function(){const a=n.apply(this,arguments),u=this.$fastController;return u!==void 0&&u.addSplice(Ms(Ze(this.length-arguments.length,[],arguments.length),this)),a},t.reverse=function(){let a;const u=this.$fastController;u!==void 0&&(u.flush(),a=this.slice());const h=i.apply(this,arguments);return u!==void 0&&u.reset(a),h},t.shift=function(){const a=this.length>0,u=r.apply(this,arguments),h=this.$fastController;return h!==void 0&&a&&h.addSplice(Ze(0,[u],0)),u},t.sort=function(){let a;const u=this.$fastController;u!==void 0&&(u.flush(),a=this.slice());const h=o.apply(this,arguments);return u!==void 0&&u.reset(a),h},t.splice=function(){const a=s.apply(this,arguments),u=this.$fastController;return u!==void 0&&u.addSplice(Ms(Ze(+arguments[0],a,arguments.length>2?arguments.length-2:0),this)),a},t.unshift=function(){const a=l.apply(this,arguments),u=this.$fastController;return u!==void 0&&u.addSplice(Ms(Ze(0,[],arguments.length),this)),a}}class Rg{constructor(e,n){this.target=e,this.propertyName=n}bind(e){e[this.propertyName]=this.target}unbind(){}}function Se(t){return new Ba("fast-ref",Rg,t)}const df=t=>typeof t=="function",Pg=()=>null;function Ic(t){return t===void 0?Pg:df(t)?t:()=>t}function ja(t,e,n){const i=df(t)?t:()=>t,r=Ic(e),o=Ic(n);return(s,l)=>i(s,l)?r(s,l):o(s,l)}Object.freeze({positioning:!1,recycle:!0});function Dg(t,e,n,i){t.bind(e[n],i)}function Ag(t,e,n,i){const r=Object.create(i);r.index=n,r.length=e.length,t.bind(e[n],r)}class _g{constructor(e,n,i,r,o,s){this.location=e,this.itemsBinding=n,this.templateBinding=r,this.options=s,this.source=null,this.views=[],this.items=null,this.itemsObserver=null,this.originalContext=void 0,this.childContext=void 0,this.bindView=Dg,this.itemsBindingObserver=F.binding(n,this,i),this.templateBindingObserver=F.binding(r,this,o),s.positioning&&(this.bindView=Ag)}bind(e,n){this.source=e,this.originalContext=n,this.childContext=Object.create(n),this.childContext.parent=e,this.childContext.parentContext=this.originalContext,this.items=this.itemsBindingObserver.observe(e,this.originalContext),this.template=this.templateBindingObserver.observe(e,this.originalContext),this.observeItems(!0),this.refreshAllViews()}unbind(){this.source=null,this.items=null,this.itemsObserver!==null&&this.itemsObserver.unsubscribe(this),this.unbindAllViews(),this.itemsBindingObserver.disconnect(),this.templateBindingObserver.disconnect()}handleChange(e,n){e===this.itemsBinding?(this.items=this.itemsBindingObserver.observe(this.source,this.originalContext),this.observeItems(),this.refreshAllViews()):e===this.templateBinding?(this.template=this.templateBindingObserver.observe(this.source,this.originalContext),this.refreshAllViews(!0)):this.updateViews(n)}observeItems(e=!1){if(!this.items){this.items=sn;return}const n=this.itemsObserver,i=this.itemsObserver=F.getNotifier(this.items),r=n!==i;r&&n!==null&&n.unsubscribe(this),(r||e)&&i.subscribe(this)}updateViews(e){const n=this.childContext,i=this.views,r=this.bindView,o=this.items,s=this.template,l=this.options.recycle,a=[];let u=0,h=0;for(let g=0,p=e.length;g<p;++g){const w=e[g],k=w.removed;let $=0,f=w.index;const c=f+w.addedCount,d=i.splice(w.index,k.length),v=h=a.length+d.length;for(;f<c;++f){const y=i[f],O=y?y.firstChild:this.location;let C;l&&h>0?($<=v&&d.length>0?(C=d[$],$++):(C=a[u],u++),h--):C=s.create(),i.splice(f,0,C),r(C,o,f,n),C.insertBefore(O)}d[$]&&a.push(...d.slice($))}for(let g=u,p=a.length;g<p;++g)a[g].dispose();if(this.options.positioning)for(let g=0,p=i.length;g<p;++g){const w=i[g].context;w.length=p,w.index=g}}refreshAllViews(e=!1){const n=this.items,i=this.childContext,r=this.template,o=this.location,s=this.bindView;let l=n.length,a=this.views,u=a.length;if((l===0||e||!this.options.recycle)&&(ef.disposeContiguousBatch(a),u=0),u===0){this.views=a=new Array(l);for(let h=0;h<l;++h){const g=r.create();s(g,n,h,i),a[h]=g,g.insertBefore(o)}}else{let h=0;for(;h<l;++h)if(h<u){const p=a[h];s(p,n,h,i)}else{const p=r.create();s(p,n,h,i),a.push(p),p.insertBefore(o)}const g=a.splice(h,u-h);for(h=0,l=g.length;h<l;++h)g[h].dispose()}}unbindAllViews(){const e=this.views;for(let n=0,i=e.length;n<i;++n)e[n].unbind()}}class hf extends Ko{constructor(e,n,i){super(),this.itemsBinding=e,this.templateBinding=n,this.options=i,this.createPlaceholder=B.createBlockPlaceholder,Og(),this.isItemsBindingVolatile=F.isVolatileBinding(e),this.isTemplateBindingVolatile=F.isVolatileBinding(n)}createBehavior(e){return new _g(e,this.itemsBinding,this.isItemsBindingVolatile,this.templateBinding,this.isTemplateBindingVolatile,this.options)}}function Ua(t){return t?function(e,n,i){return e.nodeType===1&&e.matches(t)}:function(e,n,i){return e.nodeType===1}}class ff{constructor(e,n){this.target=e,this.options=n,this.source=null}bind(e){const n=this.options.property;this.shouldUpdate=F.getAccessors(e).some(i=>i.name===n),this.source=e,this.updateTarget(this.computeNodes()),this.shouldUpdate&&this.observe()}unbind(){this.updateTarget(sn),this.source=null,this.shouldUpdate&&this.disconnect()}handleEvent(){this.updateTarget(this.computeNodes())}computeNodes(){let e=this.getNodes();return this.options.filter!==void 0&&(e=e.filter(this.options.filter)),e}updateTarget(e){this.source[this.options.property]=e}}class Lg extends ff{constructor(e,n){super(e,n)}observe(){this.target.addEventListener("slotchange",this)}disconnect(){this.target.removeEventListener("slotchange",this)}getNodes(){return this.target.assignedNodes(this.options)}}function Qe(t){return typeof t=="string"&&(t={property:t}),new Ba("fast-slotted",Lg,t)}class Ng extends ff{constructor(e,n){super(e,n),this.observer=null,n.childList=!0}observe(){this.observer===null&&(this.observer=new MutationObserver(this.handleEvent.bind(this))),this.observer.observe(this.target,this.options)}disconnect(){this.observer.disconnect()}getNodes(){return"subtree"in this.options?Array.from(this.target.querySelectorAll(this.options.selector)):Array.from(this.target.childNodes)}}function pf(t){return typeof t=="string"&&(t={property:t}),new Ba("fast-children",Ng,t)}class oi{handleStartContentChange(){this.startContainer.classList.toggle("start",this.start.assignedNodes().length>0)}handleEndContentChange(){this.endContainer.classList.toggle("end",this.end.assignedNodes().length>0)}}const si=(t,e)=>V`
    <span
        part="end"
        ${Se("endContainer")}
        class=${n=>e.end?"end":void 0}
    >
        <slot name="end" ${Se("end")} @slotchange="${n=>n.handleEndContentChange()}">
            ${e.end||""}
        </slot>
    </span>
`,li=(t,e)=>V`
    <span
        part="start"
        ${Se("startContainer")}
        class="${n=>e.start?"start":void 0}"
    >
        <slot
            name="start"
            ${Se("start")}
            @slotchange="${n=>n.handleStartContentChange()}"
        >
            ${e.start||""}
        </slot>
    </span>
`;V`
    <span part="end" ${Se("endContainer")}>
        <slot
            name="end"
            ${Se("end")}
            @slotchange="${t=>t.handleEndContentChange()}"
        ></slot>
    </span>
`;V`
    <span part="start" ${Se("startContainer")}>
        <slot
            name="start"
            ${Se("start")}
            @slotchange="${t=>t.handleStartContentChange()}"
        ></slot>
    </span>
`;/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */function m(t,e,n,i){var r=arguments.length,o=r<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,n):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(t,e,n,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(o=(r<3?s(o):r>3?s(e,n,o):s(e,n))||o);return r>3&&o&&Object.defineProperty(e,n,o),o}const zs=new Map;"metadata"in Reflect||(Reflect.metadata=function(t,e){return function(n){Reflect.defineMetadata(t,e,n)}},Reflect.defineMetadata=function(t,e,n){let i=zs.get(n);i===void 0&&zs.set(n,i=new Map),i.set(t,e)},Reflect.getOwnMetadata=function(t,e){const n=zs.get(e);if(n!==void 0)return n.get(t)});class Fg{constructor(e,n){this.container=e,this.key=n}instance(e){return this.registerResolver(0,e)}singleton(e){return this.registerResolver(1,e)}transient(e){return this.registerResolver(2,e)}callback(e){return this.registerResolver(3,e)}cachedCallback(e){return this.registerResolver(3,gf(e))}aliasTo(e){return this.registerResolver(5,e)}registerResolver(e,n){const{container:i,key:r}=this;return this.container=this.key=void 0,i.registerResolver(r,new ze(r,e,n))}}function Ei(t){const e=t.slice(),n=Object.keys(t),i=n.length;let r;for(let o=0;o<i;++o)r=n[o],vf(r)||(e[r]=t[r]);return e}const Bg=Object.freeze({none(t){throw Error(`${t.toString()} not registered, did you forget to add @singleton()?`)},singleton(t){return new ze(t,1,t)},transient(t){return new ze(t,2,t)}}),Vs=Object.freeze({default:Object.freeze({parentLocator:()=>null,responsibleForOwnerRequests:!1,defaultResolver:Bg.singleton})}),Oc=new Map;function Rc(t){return e=>Reflect.getOwnMetadata(t,e)}let Pc=null;const Y=Object.freeze({createContainer(t){return new Xi(null,Object.assign({},Vs.default,t))},findResponsibleContainer(t){const e=t.$$container$$;return e&&e.responsibleForOwnerRequests?e:Y.findParentContainer(t)},findParentContainer(t){const e=new CustomEvent(mf,{bubbles:!0,composed:!0,cancelable:!0,detail:{container:void 0}});return t.dispatchEvent(e),e.detail.container||Y.getOrCreateDOMContainer()},getOrCreateDOMContainer(t,e){return t?t.$$container$$||new Xi(t,Object.assign({},Vs.default,e,{parentLocator:Y.findParentContainer})):Pc||(Pc=new Xi(null,Object.assign({},Vs.default,e,{parentLocator:()=>null})))},getDesignParamtypes:Rc("design:paramtypes"),getAnnotationParamtypes:Rc("di:paramtypes"),getOrCreateAnnotationParamTypes(t){let e=this.getAnnotationParamtypes(t);return e===void 0&&Reflect.defineMetadata("di:paramtypes",e=[],t),e},getDependencies(t){let e=Oc.get(t);if(e===void 0){const n=t.inject;if(n===void 0){const i=Y.getDesignParamtypes(t),r=Y.getAnnotationParamtypes(t);if(i===void 0)if(r===void 0){const o=Object.getPrototypeOf(t);typeof o=="function"&&o!==Function.prototype?e=Ei(Y.getDependencies(o)):e=[]}else e=Ei(r);else if(r===void 0)e=Ei(i);else{e=Ei(i);let o=r.length,s;for(let u=0;u<o;++u)s=r[u],s!==void 0&&(e[u]=s);const l=Object.keys(r);o=l.length;let a;for(let u=0;u<o;++u)a=l[u],vf(a)||(e[a]=r[a])}}else e=Ei(n);Oc.set(t,e)}return e},defineProperty(t,e,n,i=!1){const r=`$di_${e}`;Reflect.defineProperty(t,e,{get:function(){let o=this[r];if(o===void 0&&(o=(this instanceof HTMLElement?Y.findResponsibleContainer(this):Y.getOrCreateDOMContainer()).get(n),this[r]=o,i&&this instanceof es)){const l=this.$fastController,a=()=>{const h=Y.findResponsibleContainer(this).get(n),g=this[r];h!==g&&(this[r]=o,l.notify(e))};l.subscribe({handleChange:a},"isConnected")}return o}})},createInterface(t,e){const n=typeof t=="function"?t:e,i=typeof t=="string"?t:t&&"friendlyName"in t&&t.friendlyName||Lc,r=typeof t=="string"?!1:t&&"respectConnection"in t&&t.respectConnection||!1,o=function(s,l,a){if(s==null||new.target!==void 0)throw new Error(`No registration for interface: '${o.friendlyName}'`);if(l)Y.defineProperty(s,l,o,r);else{const u=Y.getOrCreateAnnotationParamTypes(s);u[a]=o}};return o.$isInterface=!0,o.friendlyName=i==null?"(anonymous)":i,n!=null&&(o.register=function(s,l){return n(new Fg(s,l!=null?l:o))}),o.toString=function(){return`InterfaceSymbol<${o.friendlyName}>`},o},inject(...t){return function(e,n,i){if(typeof i=="number"){const r=Y.getOrCreateAnnotationParamTypes(e),o=t[0];o!==void 0&&(r[i]=o)}else if(n)Y.defineProperty(e,n,t[0]);else{const r=i?Y.getOrCreateAnnotationParamTypes(i.value):Y.getOrCreateAnnotationParamTypes(e);let o;for(let s=0;s<t.length;++s)o=t[s],o!==void 0&&(r[s]=o)}}},transient(t){return t.register=function(n){return pr.transient(t,t).register(n)},t.registerInRequestor=!1,t},singleton(t,e=zg){return t.register=function(i){return pr.singleton(t,t).register(i)},t.registerInRequestor=e.scoped,t}}),Mg=Y.createInterface("Container");Y.inject;const zg={scoped:!1};class ze{constructor(e,n,i){this.key=e,this.strategy=n,this.state=i,this.resolving=!1}get $isResolver(){return!0}register(e){return e.registerResolver(this.key,this)}resolve(e,n){switch(this.strategy){case 0:return this.state;case 1:{if(this.resolving)throw new Error(`Cyclic dependency found: ${this.state.name}`);return this.resolving=!0,this.state=e.getFactory(this.state).construct(n),this.strategy=0,this.resolving=!1,this.state}case 2:{const i=e.getFactory(this.state);if(i===null)throw new Error(`Resolver for ${String(this.key)} returned a null factory`);return i.construct(n)}case 3:return this.state(e,n,this);case 4:return this.state[0].resolve(e,n);case 5:return n.get(this.state);default:throw new Error(`Invalid resolver strategy specified: ${this.strategy}.`)}}getFactory(e){var n,i,r;switch(this.strategy){case 1:case 2:return e.getFactory(this.state);case 5:return(r=(i=(n=e.getResolver(this.state))===null||n===void 0?void 0:n.getFactory)===null||i===void 0?void 0:i.call(n,e))!==null&&r!==void 0?r:null;default:return null}}}function Dc(t){return this.get(t)}function Vg(t,e){return e(t)}class Hg{constructor(e,n){this.Type=e,this.dependencies=n,this.transformers=null}construct(e,n){let i;return n===void 0?i=new this.Type(...this.dependencies.map(Dc,e)):i=new this.Type(...this.dependencies.map(Dc,e),...n),this.transformers==null?i:this.transformers.reduce(Vg,i)}registerTransformer(e){(this.transformers||(this.transformers=[])).push(e)}}const jg={$isResolver:!0,resolve(t,e){return e}};function so(t){return typeof t.register=="function"}function Ug(t){return so(t)&&typeof t.registerInRequestor=="boolean"}function Ac(t){return Ug(t)&&t.registerInRequestor}function Wg(t){return t.prototype!==void 0}const Qg=new Set(["Array","ArrayBuffer","Boolean","DataView","Date","Error","EvalError","Float32Array","Float64Array","Function","Int8Array","Int16Array","Int32Array","Map","Number","Object","Promise","RangeError","ReferenceError","RegExp","Set","SharedArrayBuffer","String","SyntaxError","TypeError","Uint8Array","Uint8ClampedArray","Uint16Array","Uint32Array","URIError","WeakMap","WeakSet"]),mf="__DI_LOCATE_PARENT__",Hs=new Map;class Xi{constructor(e,n){this.owner=e,this.config=n,this._parent=void 0,this.registerDepth=0,this.context=null,e!==null&&(e.$$container$$=this),this.resolvers=new Map,this.resolvers.set(Mg,jg),e instanceof Node&&e.addEventListener(mf,i=>{i.composedPath()[0]!==this.owner&&(i.detail.container=this,i.stopImmediatePropagation())})}get parent(){return this._parent===void 0&&(this._parent=this.config.parentLocator(this.owner)),this._parent}get depth(){return this.parent===null?0:this.parent.depth+1}get responsibleForOwnerRequests(){return this.config.responsibleForOwnerRequests}registerWithContext(e,...n){return this.context=e,this.register(...n),this.context=null,this}register(...e){if(++this.registerDepth===100)throw new Error("Unable to autoregister dependency");let n,i,r,o,s;const l=this.context;for(let a=0,u=e.length;a<u;++a)if(n=e[a],!!Nc(n))if(so(n))n.register(this,l);else if(Wg(n))pr.singleton(n,n).register(this);else for(i=Object.keys(n),o=0,s=i.length;o<s;++o)r=n[i[o]],Nc(r)&&(so(r)?r.register(this,l):this.register(r));return--this.registerDepth,this}registerResolver(e,n){Hr(e);const i=this.resolvers,r=i.get(e);return r==null?i.set(e,n):r instanceof ze&&r.strategy===4?r.state.push(n):i.set(e,new ze(e,4,[r,n])),n}registerTransformer(e,n){const i=this.getResolver(e);if(i==null)return!1;if(i.getFactory){const r=i.getFactory(this);return r==null?!1:(r.registerTransformer(n),!0)}return!1}getResolver(e,n=!0){if(Hr(e),e.resolve!==void 0)return e;let i=this,r;for(;i!=null;)if(r=i.resolvers.get(e),r==null){if(i.parent==null){const o=Ac(e)?this:i;return n?this.jitRegister(e,o):null}i=i.parent}else return r;return null}has(e,n=!1){return this.resolvers.has(e)?!0:n&&this.parent!=null?this.parent.has(e,!0):!1}get(e){if(Hr(e),e.$isResolver)return e.resolve(this,this);let n=this,i;for(;n!=null;)if(i=n.resolvers.get(e),i==null){if(n.parent==null){const r=Ac(e)?this:n;return i=this.jitRegister(e,r),i.resolve(n,this)}n=n.parent}else return i.resolve(n,this);throw new Error(`Unable to resolve key: ${String(e)}`)}getAll(e,n=!1){Hr(e);const i=this;let r=i,o;if(n){let s=sn;for(;r!=null;)o=r.resolvers.get(e),o!=null&&(s=s.concat(_c(o,r,i))),r=r.parent;return s}else for(;r!=null;)if(o=r.resolvers.get(e),o==null){if(r=r.parent,r==null)return sn}else return _c(o,r,i);return sn}getFactory(e){let n=Hs.get(e);if(n===void 0){if(qg(e))throw new Error(`${e.name} is a native function and therefore cannot be safely constructed by DI. If this is intentional, please use a callback or cachedCallback resolver.`);Hs.set(e,n=new Hg(e,Y.getDependencies(e)))}return n}registerFactory(e,n){Hs.set(e,n)}createChild(e){return new Xi(null,Object.assign({},this.config,e,{parentLocator:()=>this}))}jitRegister(e,n){if(typeof e!="function")throw new Error(`Attempted to jitRegister something that is not a constructor: '${e}'. Did you forget to register this dependency?`);if(Qg.has(e.name))throw new Error(`Attempted to jitRegister an intrinsic type: ${e.name}. Did you forget to add @inject(Key)`);if(so(e)){const i=e.register(n);if(!(i instanceof Object)||i.resolve==null){const r=n.resolvers.get(e);if(r!=null)return r;throw new Error("A valid resolver was not returned from the static register method")}return i}else{if(e.$isInterface)throw new Error(`Attempted to jitRegister an interface: ${e.friendlyName}`);{const i=this.config.defaultResolver(e,n);return n.resolvers.set(e,i),i}}}}const js=new WeakMap;function gf(t){return function(e,n,i){if(js.has(i))return js.get(i);const r=t(e,n,i);return js.set(i,r),r}}const pr=Object.freeze({instance(t,e){return new ze(t,0,e)},singleton(t,e){return new ze(t,1,e)},transient(t,e){return new ze(t,2,e)},callback(t,e){return new ze(t,3,e)},cachedCallback(t,e){return new ze(t,3,gf(e))},aliasTo(t,e){return new ze(e,5,t)}});function Hr(t){if(t==null)throw new Error("key/value cannot be null or undefined. Are you trying to inject/register something that doesn't exist with DI?")}function _c(t,e,n){if(t instanceof ze&&t.strategy===4){const i=t.state;let r=i.length;const o=new Array(r);for(;r--;)o[r]=i[r].resolve(e,n);return o}return[t.resolve(e,n)]}const Lc="(anonymous)";function Nc(t){return typeof t=="object"&&t!==null||typeof t=="function"}const qg=function(){const t=new WeakMap;let e=!1,n="",i=0;return function(r){return e=t.get(r),e===void 0&&(n=r.toString(),i=n.length,e=i>=29&&i<=100&&n.charCodeAt(i-1)===125&&n.charCodeAt(i-2)<=32&&n.charCodeAt(i-3)===93&&n.charCodeAt(i-4)===101&&n.charCodeAt(i-5)===100&&n.charCodeAt(i-6)===111&&n.charCodeAt(i-7)===99&&n.charCodeAt(i-8)===32&&n.charCodeAt(i-9)===101&&n.charCodeAt(i-10)===118&&n.charCodeAt(i-11)===105&&n.charCodeAt(i-12)===116&&n.charCodeAt(i-13)===97&&n.charCodeAt(i-14)===110&&n.charCodeAt(i-15)===88,t.set(r,e)),e}}(),jr={};function vf(t){switch(typeof t){case"number":return t>=0&&(t|0)===t;case"string":{const e=jr[t];if(e!==void 0)return e;const n=t.length;if(n===0)return jr[t]=!1;let i=0;for(let r=0;r<n;++r)if(i=t.charCodeAt(r),r===0&&i===48&&n>1||i<48||i>57)return jr[t]=!1;return jr[t]=!0}default:return!1}}function Fc(t){return`${t.toLowerCase()}:presentation`}const Ur=new Map,yf=Object.freeze({define(t,e,n){const i=Fc(t);Ur.get(i)===void 0?Ur.set(i,e):Ur.set(i,!1),n.register(pr.instance(i,e))},forTag(t,e){const n=Fc(t),i=Ur.get(n);return i===!1?Y.findResponsibleContainer(e).get(n):i||null}});class Gg{constructor(e,n){this.template=e||null,this.styles=n===void 0?null:Array.isArray(n)?Ae.create(n):n instanceof Ae?n:Ae.create([n])}applyTo(e){const n=e.$fastController;n.template===null&&(n.template=this.template),n.styles===null&&(n.styles=this.styles)}}class q extends es{constructor(){super(...arguments),this._presentation=void 0}get $presentation(){return this._presentation===void 0&&(this._presentation=yf.forTag(this.tagName,this)),this._presentation}templateChanged(){this.template!==void 0&&(this.$fastController.template=this.template)}stylesChanged(){this.styles!==void 0&&(this.$fastController.styles=this.styles)}connectedCallback(){this.$presentation!==null&&this.$presentation.applyTo(this),super.connectedCallback()}static compose(e){return(n={})=>new bf(this===q?class extends q{}:this,e,n)}}m([I],q.prototype,"template",void 0);m([I],q.prototype,"styles",void 0);function Ti(t,e,n){return typeof t=="function"?t(e,n):t}class bf{constructor(e,n,i){this.type=e,this.elementDefinition=n,this.overrideDefinition=i,this.definition=Object.assign(Object.assign({},this.elementDefinition),this.overrideDefinition)}register(e,n){const i=this.definition,r=this.overrideDefinition,s=`${i.prefix||n.elementPrefix}-${i.baseName}`;n.tryDefineElement({name:s,type:this.type,baseClass:this.elementDefinition.baseClass,callback:l=>{const a=new Gg(Ti(i.template,l,i),Ti(i.styles,l,i));l.definePresentation(a);let u=Ti(i.shadowOptions,l,i);l.shadowRootMode&&(u?r.shadowOptions||(u.mode=l.shadowRootMode):u!==null&&(u={mode:l.shadowRootMode})),l.defineElement({elementOptions:Ti(i.elementOptions,l,i),shadowOptions:u,attributes:Ti(i.attributes,l,i)})}})}}function Le(t,...e){const n=_o.locate(t);e.forEach(i=>{Object.getOwnPropertyNames(i.prototype).forEach(o=>{o!=="constructor"&&Object.defineProperty(t.prototype,o,Object.getOwnPropertyDescriptor(i.prototype,o))}),_o.locate(i).forEach(o=>n.push(o))})}const Wa={horizontal:"horizontal",vertical:"vertical"};function Yg(t,e){let n=t.length;for(;n--;)if(e(t[n],n,t))return n;return-1}function Xg(){return!!(typeof window!="undefined"&&window.document&&window.document.createElement)}function Zg(...t){return t.every(e=>e instanceof HTMLElement)}function Jg(){const t=document.querySelector('meta[property="csp-nonce"]');return t?t.getAttribute("content"):null}let Yt;function Kg(){if(typeof Yt=="boolean")return Yt;if(!Xg())return Yt=!1,Yt;const t=document.createElement("style"),e=Jg();e!==null&&t.setAttribute("nonce",e),document.head.appendChild(t);try{t.sheet.insertRule("foo:focus-visible {color:inherit}",0),Yt=!0}catch{Yt=!1}finally{document.head.removeChild(t)}return Yt}const Bc="focus",Mc="focusin",Yn="focusout",Xn="keydown";var zc;(function(t){t[t.alt=18]="alt",t[t.arrowDown=40]="arrowDown",t[t.arrowLeft=37]="arrowLeft",t[t.arrowRight=39]="arrowRight",t[t.arrowUp=38]="arrowUp",t[t.back=8]="back",t[t.backSlash=220]="backSlash",t[t.break=19]="break",t[t.capsLock=20]="capsLock",t[t.closeBracket=221]="closeBracket",t[t.colon=186]="colon",t[t.colon2=59]="colon2",t[t.comma=188]="comma",t[t.ctrl=17]="ctrl",t[t.delete=46]="delete",t[t.end=35]="end",t[t.enter=13]="enter",t[t.equals=187]="equals",t[t.equals2=61]="equals2",t[t.equals3=107]="equals3",t[t.escape=27]="escape",t[t.forwardSlash=191]="forwardSlash",t[t.function1=112]="function1",t[t.function10=121]="function10",t[t.function11=122]="function11",t[t.function12=123]="function12",t[t.function2=113]="function2",t[t.function3=114]="function3",t[t.function4=115]="function4",t[t.function5=116]="function5",t[t.function6=117]="function6",t[t.function7=118]="function7",t[t.function8=119]="function8",t[t.function9=120]="function9",t[t.home=36]="home",t[t.insert=45]="insert",t[t.menu=93]="menu",t[t.minus=189]="minus",t[t.minus2=109]="minus2",t[t.numLock=144]="numLock",t[t.numPad0=96]="numPad0",t[t.numPad1=97]="numPad1",t[t.numPad2=98]="numPad2",t[t.numPad3=99]="numPad3",t[t.numPad4=100]="numPad4",t[t.numPad5=101]="numPad5",t[t.numPad6=102]="numPad6",t[t.numPad7=103]="numPad7",t[t.numPad8=104]="numPad8",t[t.numPad9=105]="numPad9",t[t.numPadDivide=111]="numPadDivide",t[t.numPadDot=110]="numPadDot",t[t.numPadMinus=109]="numPadMinus",t[t.numPadMultiply=106]="numPadMultiply",t[t.numPadPlus=107]="numPadPlus",t[t.openBracket=219]="openBracket",t[t.pageDown=34]="pageDown",t[t.pageUp=33]="pageUp",t[t.period=190]="period",t[t.print=44]="print",t[t.quote=222]="quote",t[t.scrollLock=145]="scrollLock",t[t.shift=16]="shift",t[t.space=32]="space",t[t.tab=9]="tab",t[t.tilde=192]="tilde",t[t.windowsLeft=91]="windowsLeft",t[t.windowsOpera=219]="windowsOpera",t[t.windowsRight=92]="windowsRight"})(zc||(zc={}));const mn="ArrowDown",mr="ArrowLeft",gr="ArrowRight",gn="ArrowUp",$r="Enter",ts="Escape",ai="Home",ui="End",ev="F2",tv="PageDown",nv="PageUp",Sr=" ",Qa="Tab",iv={ArrowDown:mn,ArrowLeft:mr,ArrowRight:gr,ArrowUp:gn};var Zn;(function(t){t.ltr="ltr",t.rtl="rtl"})(Zn||(Zn={}));function rv(t,e,n){return Math.min(Math.max(n,t),e)}function Wr(t,e,n=0){return[e,n]=[e,n].sort((i,r)=>i-r),e<=t&&t<n}let ov=0;function No(t=""){return`${t}${ov++}`}const sv=(t,e)=>V`
    <a
        class="control"
        part="control"
        download="${n=>n.download}"
        href="${n=>n.href}"
        hreflang="${n=>n.hreflang}"
        ping="${n=>n.ping}"
        referrerpolicy="${n=>n.referrerpolicy}"
        rel="${n=>n.rel}"
        target="${n=>n.target}"
        type="${n=>n.type}"
        aria-atomic="${n=>n.ariaAtomic}"
        aria-busy="${n=>n.ariaBusy}"
        aria-controls="${n=>n.ariaControls}"
        aria-current="${n=>n.ariaCurrent}"
        aria-describedby="${n=>n.ariaDescribedby}"
        aria-details="${n=>n.ariaDetails}"
        aria-disabled="${n=>n.ariaDisabled}"
        aria-errormessage="${n=>n.ariaErrormessage}"
        aria-expanded="${n=>n.ariaExpanded}"
        aria-flowto="${n=>n.ariaFlowto}"
        aria-haspopup="${n=>n.ariaHaspopup}"
        aria-hidden="${n=>n.ariaHidden}"
        aria-invalid="${n=>n.ariaInvalid}"
        aria-keyshortcuts="${n=>n.ariaKeyshortcuts}"
        aria-label="${n=>n.ariaLabel}"
        aria-labelledby="${n=>n.ariaLabelledby}"
        aria-live="${n=>n.ariaLive}"
        aria-owns="${n=>n.ariaOwns}"
        aria-relevant="${n=>n.ariaRelevant}"
        aria-roledescription="${n=>n.ariaRoledescription}"
        ${Se("control")}
    >
        ${li(t,e)}
        <span class="content" part="content">
            <slot ${Qe("defaultSlottedContent")}></slot>
        </span>
        ${si(t,e)}
    </a>
`;class G{}m([b({attribute:"aria-atomic"})],G.prototype,"ariaAtomic",void 0);m([b({attribute:"aria-busy"})],G.prototype,"ariaBusy",void 0);m([b({attribute:"aria-controls"})],G.prototype,"ariaControls",void 0);m([b({attribute:"aria-current"})],G.prototype,"ariaCurrent",void 0);m([b({attribute:"aria-describedby"})],G.prototype,"ariaDescribedby",void 0);m([b({attribute:"aria-details"})],G.prototype,"ariaDetails",void 0);m([b({attribute:"aria-disabled"})],G.prototype,"ariaDisabled",void 0);m([b({attribute:"aria-errormessage"})],G.prototype,"ariaErrormessage",void 0);m([b({attribute:"aria-flowto"})],G.prototype,"ariaFlowto",void 0);m([b({attribute:"aria-haspopup"})],G.prototype,"ariaHaspopup",void 0);m([b({attribute:"aria-hidden"})],G.prototype,"ariaHidden",void 0);m([b({attribute:"aria-invalid"})],G.prototype,"ariaInvalid",void 0);m([b({attribute:"aria-keyshortcuts"})],G.prototype,"ariaKeyshortcuts",void 0);m([b({attribute:"aria-label"})],G.prototype,"ariaLabel",void 0);m([b({attribute:"aria-labelledby"})],G.prototype,"ariaLabelledby",void 0);m([b({attribute:"aria-live"})],G.prototype,"ariaLive",void 0);m([b({attribute:"aria-owns"})],G.prototype,"ariaOwns",void 0);m([b({attribute:"aria-relevant"})],G.prototype,"ariaRelevant",void 0);m([b({attribute:"aria-roledescription"})],G.prototype,"ariaRoledescription",void 0);class et extends q{constructor(){super(...arguments),this.handleUnsupportedDelegatesFocus=()=>{var e;window.ShadowRoot&&!window.ShadowRoot.prototype.hasOwnProperty("delegatesFocus")&&((e=this.$fastController.definition.shadowOptions)===null||e===void 0?void 0:e.delegatesFocus)&&(this.focus=()=>{var n;(n=this.control)===null||n===void 0||n.focus()})}}connectedCallback(){super.connectedCallback(),this.handleUnsupportedDelegatesFocus()}}m([b],et.prototype,"download",void 0);m([b],et.prototype,"href",void 0);m([b],et.prototype,"hreflang",void 0);m([b],et.prototype,"ping",void 0);m([b],et.prototype,"referrerpolicy",void 0);m([b],et.prototype,"rel",void 0);m([b],et.prototype,"target",void 0);m([b],et.prototype,"type",void 0);m([I],et.prototype,"defaultSlottedContent",void 0);class qa{}m([b({attribute:"aria-expanded"})],qa.prototype,"ariaExpanded",void 0);Le(qa,G);Le(et,oi,qa);const lv=t=>{const e=t.closest("[dir]");return e!==null&&e.dir==="rtl"?Zn.rtl:Zn.ltr},wf=(t,e)=>V`
    <template class="${n=>n.circular?"circular":""}">
        <div class="control" part="control" style="${n=>n.generateBadgeStyle()}">
            <slot></slot>
        </div>
    </template>
`;class Er extends q{constructor(){super(...arguments),this.generateBadgeStyle=()=>{if(!this.fill&&!this.color)return;const e=`background-color: var(--badge-fill-${this.fill});`,n=`color: var(--badge-color-${this.color});`;return this.fill&&!this.color?e:this.color&&!this.fill?n:`${n} ${e}`}}}m([b({attribute:"fill"})],Er.prototype,"fill",void 0);m([b({attribute:"color"})],Er.prototype,"color",void 0);m([b({mode:"boolean"})],Er.prototype,"circular",void 0);const av=(t,e)=>V`
    <button
        class="control"
        part="control"
        ?autofocus="${n=>n.autofocus}"
        ?disabled="${n=>n.disabled}"
        form="${n=>n.formId}"
        formaction="${n=>n.formaction}"
        formenctype="${n=>n.formenctype}"
        formmethod="${n=>n.formmethod}"
        formnovalidate="${n=>n.formnovalidate}"
        formtarget="${n=>n.formtarget}"
        name="${n=>n.name}"
        type="${n=>n.type}"
        value="${n=>n.value}"
        aria-atomic="${n=>n.ariaAtomic}"
        aria-busy="${n=>n.ariaBusy}"
        aria-controls="${n=>n.ariaControls}"
        aria-current="${n=>n.ariaCurrent}"
        aria-describedby="${n=>n.ariaDescribedby}"
        aria-details="${n=>n.ariaDetails}"
        aria-disabled="${n=>n.ariaDisabled}"
        aria-errormessage="${n=>n.ariaErrormessage}"
        aria-expanded="${n=>n.ariaExpanded}"
        aria-flowto="${n=>n.ariaFlowto}"
        aria-haspopup="${n=>n.ariaHaspopup}"
        aria-hidden="${n=>n.ariaHidden}"
        aria-invalid="${n=>n.ariaInvalid}"
        aria-keyshortcuts="${n=>n.ariaKeyshortcuts}"
        aria-label="${n=>n.ariaLabel}"
        aria-labelledby="${n=>n.ariaLabelledby}"
        aria-live="${n=>n.ariaLive}"
        aria-owns="${n=>n.ariaOwns}"
        aria-pressed="${n=>n.ariaPressed}"
        aria-relevant="${n=>n.ariaRelevant}"
        aria-roledescription="${n=>n.ariaRoledescription}"
        ${Se("control")}
    >
        ${li(t,e)}
        <span class="content" part="content">
            <slot ${Qe("defaultSlottedContent")}></slot>
        </span>
        ${si(t,e)}
    </button>
`,Vc="form-associated-proxy",Hc="ElementInternals",jc=Hc in window&&"setFormValue"in window[Hc].prototype,Uc=new WeakMap;function Tr(t){const e=class extends t{constructor(...n){super(...n),this.dirtyValue=!1,this.disabled=!1,this.proxyEventsToBlock=["change","click"],this.proxyInitialized=!1,this.required=!1,this.initialValue=this.initialValue||"",this.elementInternals||(this.formResetCallback=this.formResetCallback.bind(this))}static get formAssociated(){return jc}get validity(){return this.elementInternals?this.elementInternals.validity:this.proxy.validity}get form(){return this.elementInternals?this.elementInternals.form:this.proxy.form}get validationMessage(){return this.elementInternals?this.elementInternals.validationMessage:this.proxy.validationMessage}get willValidate(){return this.elementInternals?this.elementInternals.willValidate:this.proxy.willValidate}get labels(){if(this.elementInternals)return Object.freeze(Array.from(this.elementInternals.labels));if(this.proxy instanceof HTMLElement&&this.proxy.ownerDocument&&this.id){const n=this.proxy.labels,i=Array.from(this.proxy.getRootNode().querySelectorAll(`[for='${this.id}']`)),r=n?i.concat(Array.from(n)):i;return Object.freeze(r)}else return sn}valueChanged(n,i){this.dirtyValue=!0,this.proxy instanceof HTMLElement&&(this.proxy.value=this.value),this.currentValue=this.value,this.setFormValue(this.value),this.validate()}currentValueChanged(){this.value=this.currentValue}initialValueChanged(n,i){this.dirtyValue||(this.value=this.initialValue,this.dirtyValue=!1)}disabledChanged(n,i){this.proxy instanceof HTMLElement&&(this.proxy.disabled=this.disabled),B.queueUpdate(()=>this.classList.toggle("disabled",this.disabled))}nameChanged(n,i){this.proxy instanceof HTMLElement&&(this.proxy.name=this.name)}requiredChanged(n,i){this.proxy instanceof HTMLElement&&(this.proxy.required=this.required),B.queueUpdate(()=>this.classList.toggle("required",this.required)),this.validate()}get elementInternals(){if(!jc)return null;let n=Uc.get(this);return n||(n=this.attachInternals(),Uc.set(this,n)),n}connectedCallback(){super.connectedCallback(),this.addEventListener("keypress",this._keypressHandler),this.value||(this.value=this.initialValue,this.dirtyValue=!1),this.elementInternals||(this.attachProxy(),this.form&&this.form.addEventListener("reset",this.formResetCallback))}disconnectedCallback(){super.disconnectedCallback(),this.proxyEventsToBlock.forEach(n=>this.proxy.removeEventListener(n,this.stopPropagation)),!this.elementInternals&&this.form&&this.form.removeEventListener("reset",this.formResetCallback)}checkValidity(){return this.elementInternals?this.elementInternals.checkValidity():this.proxy.checkValidity()}reportValidity(){return this.elementInternals?this.elementInternals.reportValidity():this.proxy.reportValidity()}setValidity(n,i,r){this.elementInternals?this.elementInternals.setValidity(n,i,r):typeof i=="string"&&this.proxy.setCustomValidity(i)}formDisabledCallback(n){this.disabled=n}formResetCallback(){this.value=this.initialValue,this.dirtyValue=!1}attachProxy(){var n;this.proxyInitialized||(this.proxyInitialized=!0,this.proxy.style.display="none",this.proxyEventsToBlock.forEach(i=>this.proxy.addEventListener(i,this.stopPropagation)),this.proxy.disabled=this.disabled,this.proxy.required=this.required,typeof this.name=="string"&&(this.proxy.name=this.name),typeof this.value=="string"&&(this.proxy.value=this.value),this.proxy.setAttribute("slot",Vc),this.proxySlot=document.createElement("slot"),this.proxySlot.setAttribute("name",Vc)),(n=this.shadowRoot)===null||n===void 0||n.appendChild(this.proxySlot),this.appendChild(this.proxy)}detachProxy(){var n;this.removeChild(this.proxy),(n=this.shadowRoot)===null||n===void 0||n.removeChild(this.proxySlot)}validate(n){this.proxy instanceof HTMLElement&&this.setValidity(this.proxy.validity,this.proxy.validationMessage,n)}setFormValue(n,i){this.elementInternals&&this.elementInternals.setFormValue(n,i||n)}_keypressHandler(n){switch(n.key){case $r:if(this.form instanceof HTMLFormElement){const i=this.form.querySelector("[type=submit]");i==null||i.click()}break}}stopPropagation(n){n.stopPropagation()}};return b({mode:"boolean"})(e.prototype,"disabled"),b({mode:"fromView",attribute:"value"})(e.prototype,"initialValue"),b({attribute:"current-value"})(e.prototype,"currentValue"),b(e.prototype,"name"),b({mode:"boolean"})(e.prototype,"required"),I(e.prototype,"value"),e}function xf(t){class e extends Tr(t){}class n extends e{constructor(...r){super(r),this.dirtyChecked=!1,this.checkedAttribute=!1,this.checked=!1,this.dirtyChecked=!1}checkedAttributeChanged(){this.defaultChecked=this.checkedAttribute}defaultCheckedChanged(){this.dirtyChecked||(this.checked=this.defaultChecked,this.dirtyChecked=!1)}checkedChanged(r,o){this.dirtyChecked||(this.dirtyChecked=!0),this.currentChecked=this.checked,this.updateForm(),this.proxy instanceof HTMLInputElement&&(this.proxy.checked=this.checked),r!==void 0&&this.$emit("change"),this.validate()}currentCheckedChanged(r,o){this.checked=this.currentChecked}updateForm(){const r=this.checked?this.value:null;this.setFormValue(r,r)}connectedCallback(){super.connectedCallback(),this.updateForm()}formResetCallback(){super.formResetCallback(),this.checked=!!this.checkedAttribute,this.dirtyChecked=!1}}return b({attribute:"checked",mode:"boolean"})(n.prototype,"checkedAttribute"),b({attribute:"current-checked",converter:of})(n.prototype,"currentChecked"),I(n.prototype,"defaultChecked"),I(n.prototype,"checked"),n}class uv extends q{}class cv extends Tr(uv){constructor(){super(...arguments),this.proxy=document.createElement("input")}}class tt extends cv{constructor(){super(...arguments),this.handleClick=e=>{var n;this.disabled&&((n=this.defaultSlottedContent)===null||n===void 0?void 0:n.length)<=1&&e.stopPropagation()},this.handleSubmission=()=>{if(!this.form)return;const e=this.proxy.isConnected;e||this.attachProxy(),typeof this.form.requestSubmit=="function"?this.form.requestSubmit(this.proxy):this.proxy.click(),e||this.detachProxy()},this.handleFormReset=()=>{var e;(e=this.form)===null||e===void 0||e.reset()},this.handleUnsupportedDelegatesFocus=()=>{var e;window.ShadowRoot&&!window.ShadowRoot.prototype.hasOwnProperty("delegatesFocus")&&((e=this.$fastController.definition.shadowOptions)===null||e===void 0?void 0:e.delegatesFocus)&&(this.focus=()=>{this.control.focus()})}}formactionChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.formAction=this.formaction)}formenctypeChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.formEnctype=this.formenctype)}formmethodChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.formMethod=this.formmethod)}formnovalidateChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.formNoValidate=this.formnovalidate)}formtargetChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.formTarget=this.formtarget)}typeChanged(e,n){this.proxy instanceof HTMLInputElement&&(this.proxy.type=this.type),n==="submit"&&this.addEventListener("click",this.handleSubmission),e==="submit"&&this.removeEventListener("click",this.handleSubmission),n==="reset"&&this.addEventListener("click",this.handleFormReset),e==="reset"&&this.removeEventListener("click",this.handleFormReset)}validate(){super.validate(this.control)}connectedCallback(){var e;super.connectedCallback(),this.proxy.setAttribute("type",this.type),this.handleUnsupportedDelegatesFocus();const n=Array.from((e=this.control)===null||e===void 0?void 0:e.children);n&&n.forEach(i=>{i.addEventListener("click",this.handleClick)})}disconnectedCallback(){var e;super.disconnectedCallback();const n=Array.from((e=this.control)===null||e===void 0?void 0:e.children);n&&n.forEach(i=>{i.removeEventListener("click",this.handleClick)})}}m([b({mode:"boolean"})],tt.prototype,"autofocus",void 0);m([b({attribute:"form"})],tt.prototype,"formId",void 0);m([b],tt.prototype,"formaction",void 0);m([b],tt.prototype,"formenctype",void 0);m([b],tt.prototype,"formmethod",void 0);m([b({mode:"boolean"})],tt.prototype,"formnovalidate",void 0);m([b],tt.prototype,"formtarget",void 0);m([b],tt.prototype,"type",void 0);m([I],tt.prototype,"defaultSlottedContent",void 0);class ns{}m([b({attribute:"aria-expanded"})],ns.prototype,"ariaExpanded",void 0);m([b({attribute:"aria-pressed"})],ns.prototype,"ariaPressed",void 0);Le(ns,G);Le(tt,oi,ns);const Qr={none:"none",default:"default",sticky:"sticky"},bt={default:"default",columnHeader:"columnheader",rowHeader:"rowheader"},Zi={default:"default",header:"header",stickyHeader:"sticky-header"};class we extends q{constructor(){super(...arguments),this.rowType=Zi.default,this.rowData=null,this.columnDefinitions=null,this.isActiveRow=!1,this.cellsRepeatBehavior=null,this.cellsPlaceholder=null,this.focusColumnIndex=0,this.refocusOnLoad=!1,this.updateRowStyle=()=>{this.style.gridTemplateColumns=this.gridTemplateColumns}}gridTemplateColumnsChanged(){this.$fastController.isConnected&&this.updateRowStyle()}rowTypeChanged(){this.$fastController.isConnected&&this.updateItemTemplate()}rowDataChanged(){if(this.rowData!==null&&this.isActiveRow){this.refocusOnLoad=!0;return}}cellItemTemplateChanged(){this.updateItemTemplate()}headerCellItemTemplateChanged(){this.updateItemTemplate()}connectedCallback(){super.connectedCallback(),this.cellsRepeatBehavior===null&&(this.cellsPlaceholder=document.createComment(""),this.appendChild(this.cellsPlaceholder),this.updateItemTemplate(),this.cellsRepeatBehavior=new hf(e=>e.columnDefinitions,e=>e.activeCellItemTemplate,{positioning:!0}).createBehavior(this.cellsPlaceholder),this.$fastController.addBehaviors([this.cellsRepeatBehavior])),this.addEventListener("cell-focused",this.handleCellFocus),this.addEventListener(Yn,this.handleFocusout),this.addEventListener(Xn,this.handleKeydown),this.updateRowStyle(),this.refocusOnLoad&&(this.refocusOnLoad=!1,this.cellElements.length>this.focusColumnIndex&&this.cellElements[this.focusColumnIndex].focus())}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("cell-focused",this.handleCellFocus),this.removeEventListener(Yn,this.handleFocusout),this.removeEventListener(Xn,this.handleKeydown)}handleFocusout(e){this.contains(e.target)||(this.isActiveRow=!1,this.focusColumnIndex=0)}handleCellFocus(e){this.isActiveRow=!0,this.focusColumnIndex=this.cellElements.indexOf(e.target),this.$emit("row-focused",this)}handleKeydown(e){if(e.defaultPrevented)return;let n=0;switch(e.key){case mr:n=Math.max(0,this.focusColumnIndex-1),this.cellElements[n].focus(),e.preventDefault();break;case gr:n=Math.min(this.cellElements.length-1,this.focusColumnIndex+1),this.cellElements[n].focus(),e.preventDefault();break;case ai:e.ctrlKey||(this.cellElements[0].focus(),e.preventDefault());break;case ui:e.ctrlKey||(this.cellElements[this.cellElements.length-1].focus(),e.preventDefault());break}}updateItemTemplate(){this.activeCellItemTemplate=this.rowType===Zi.default&&this.cellItemTemplate!==void 0?this.cellItemTemplate:this.rowType===Zi.default&&this.cellItemTemplate===void 0?this.defaultCellItemTemplate:this.headerCellItemTemplate!==void 0?this.headerCellItemTemplate:this.defaultHeaderCellItemTemplate}}m([b({attribute:"grid-template-columns"})],we.prototype,"gridTemplateColumns",void 0);m([b({attribute:"row-type"})],we.prototype,"rowType",void 0);m([I],we.prototype,"rowData",void 0);m([I],we.prototype,"columnDefinitions",void 0);m([I],we.prototype,"cellItemTemplate",void 0);m([I],we.prototype,"headerCellItemTemplate",void 0);m([I],we.prototype,"rowIndex",void 0);m([I],we.prototype,"isActiveRow",void 0);m([I],we.prototype,"activeCellItemTemplate",void 0);m([I],we.prototype,"defaultCellItemTemplate",void 0);m([I],we.prototype,"defaultHeaderCellItemTemplate",void 0);m([I],we.prototype,"cellElements",void 0);function dv(t){const e=t.tagFor(we);return V`
    <${e}
        :rowData="${n=>n}"
        :cellItemTemplate="${(n,i)=>i.parent.cellItemTemplate}"
        :headerCellItemTemplate="${(n,i)=>i.parent.headerCellItemTemplate}"
    ></${e}>
`}const hv=(t,e)=>{const n=dv(t),i=t.tagFor(we);return V`
        <template
            role="grid"
            tabindex="0"
            :rowElementTag="${()=>i}"
            :defaultRowItemTemplate="${n}"
            ${pf({property:"rowElements",filter:Ua("[role=row]")})}
        >
            <slot></slot>
        </template>
    `};class ie extends q{constructor(){super(),this.noTabbing=!1,this.generateHeader=Qr.default,this.rowsData=[],this.columnDefinitions=null,this.focusRowIndex=0,this.focusColumnIndex=0,this.rowsPlaceholder=null,this.generatedHeader=null,this.isUpdatingFocus=!1,this.pendingFocusUpdate=!1,this.rowindexUpdateQueued=!1,this.columnDefinitionsStale=!0,this.generatedGridTemplateColumns="",this.focusOnCell=(e,n,i)=>{if(this.rowElements.length===0){this.focusRowIndex=0,this.focusColumnIndex=0;return}const r=Math.max(0,Math.min(this.rowElements.length-1,e)),s=this.rowElements[r].querySelectorAll('[role="cell"], [role="gridcell"], [role="columnheader"], [role="rowheader"]'),l=Math.max(0,Math.min(s.length-1,n)),a=s[l];i&&this.scrollHeight!==this.clientHeight&&(r<this.focusRowIndex&&this.scrollTop>0||r>this.focusRowIndex&&this.scrollTop<this.scrollHeight-this.clientHeight)&&a.scrollIntoView({block:"center",inline:"center"}),a.focus()},this.onChildListChange=(e,n)=>{e&&e.length&&(e.forEach(i=>{i.addedNodes.forEach(r=>{r.nodeType===1&&r.getAttribute("role")==="row"&&(r.columnDefinitions=this.columnDefinitions)})}),this.queueRowIndexUpdate())},this.queueRowIndexUpdate=()=>{this.rowindexUpdateQueued||(this.rowindexUpdateQueued=!0,B.queueUpdate(this.updateRowIndexes))},this.updateRowIndexes=()=>{let e=this.gridTemplateColumns;if(e===void 0){if(this.generatedGridTemplateColumns===""&&this.rowElements.length>0){const n=this.rowElements[0];this.generatedGridTemplateColumns=new Array(n.cellElements.length).fill("1fr").join(" ")}e=this.generatedGridTemplateColumns}this.rowElements.forEach((n,i)=>{const r=n;r.rowIndex=i,r.gridTemplateColumns=e,this.columnDefinitionsStale&&(r.columnDefinitions=this.columnDefinitions)}),this.rowindexUpdateQueued=!1,this.columnDefinitionsStale=!1}}static generateTemplateColumns(e){let n="";return e.forEach(i=>{n=`${n}${n===""?"":" "}1fr`}),n}noTabbingChanged(){this.$fastController.isConnected&&(this.noTabbing?this.setAttribute("tabIndex","-1"):this.setAttribute("tabIndex",this.contains(document.activeElement)||this===document.activeElement?"-1":"0"))}generateHeaderChanged(){this.$fastController.isConnected&&this.toggleGeneratedHeader()}gridTemplateColumnsChanged(){this.$fastController.isConnected&&this.updateRowIndexes()}rowsDataChanged(){this.columnDefinitions===null&&this.rowsData.length>0&&(this.columnDefinitions=ie.generateColumns(this.rowsData[0])),this.$fastController.isConnected&&this.toggleGeneratedHeader()}columnDefinitionsChanged(){if(this.columnDefinitions===null){this.generatedGridTemplateColumns="";return}this.generatedGridTemplateColumns=ie.generateTemplateColumns(this.columnDefinitions),this.$fastController.isConnected&&(this.columnDefinitionsStale=!0,this.queueRowIndexUpdate())}headerCellItemTemplateChanged(){this.$fastController.isConnected&&this.generatedHeader!==null&&(this.generatedHeader.headerCellItemTemplate=this.headerCellItemTemplate)}focusRowIndexChanged(){this.$fastController.isConnected&&this.queueFocusUpdate()}focusColumnIndexChanged(){this.$fastController.isConnected&&this.queueFocusUpdate()}connectedCallback(){super.connectedCallback(),this.rowItemTemplate===void 0&&(this.rowItemTemplate=this.defaultRowItemTemplate),this.rowsPlaceholder=document.createComment(""),this.appendChild(this.rowsPlaceholder),this.toggleGeneratedHeader(),this.rowsRepeatBehavior=new hf(e=>e.rowsData,e=>e.rowItemTemplate,{positioning:!0}).createBehavior(this.rowsPlaceholder),this.$fastController.addBehaviors([this.rowsRepeatBehavior]),this.addEventListener("row-focused",this.handleRowFocus),this.addEventListener(Bc,this.handleFocus),this.addEventListener(Xn,this.handleKeydown),this.addEventListener(Yn,this.handleFocusOut),this.observer=new MutationObserver(this.onChildListChange),this.observer.observe(this,{childList:!0}),this.noTabbing&&this.setAttribute("tabindex","-1"),B.queueUpdate(this.queueRowIndexUpdate)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("row-focused",this.handleRowFocus),this.removeEventListener(Bc,this.handleFocus),this.removeEventListener(Xn,this.handleKeydown),this.removeEventListener(Yn,this.handleFocusOut),this.observer.disconnect(),this.rowsPlaceholder=null,this.generatedHeader=null}handleRowFocus(e){this.isUpdatingFocus=!0;const n=e.target;this.focusRowIndex=this.rowElements.indexOf(n),this.focusColumnIndex=n.focusColumnIndex,this.setAttribute("tabIndex","-1"),this.isUpdatingFocus=!1}handleFocus(e){this.focusOnCell(this.focusRowIndex,this.focusColumnIndex,!0)}handleFocusOut(e){(e.relatedTarget===null||!this.contains(e.relatedTarget))&&this.setAttribute("tabIndex",this.noTabbing?"-1":"0")}handleKeydown(e){if(e.defaultPrevented)return;let n;const i=this.rowElements.length-1,r=this.offsetHeight+this.scrollTop,o=this.rowElements[i];switch(e.key){case gn:e.preventDefault(),this.focusOnCell(this.focusRowIndex-1,this.focusColumnIndex,!0);break;case mn:e.preventDefault(),this.focusOnCell(this.focusRowIndex+1,this.focusColumnIndex,!0);break;case nv:if(e.preventDefault(),this.rowElements.length===0){this.focusOnCell(0,0,!1);break}if(this.focusRowIndex===0){this.focusOnCell(0,this.focusColumnIndex,!1);return}for(n=this.focusRowIndex-1,n;n>=0;n--){const s=this.rowElements[n];if(s.offsetTop<this.scrollTop){this.scrollTop=s.offsetTop+s.clientHeight-this.clientHeight;break}}this.focusOnCell(n,this.focusColumnIndex,!1);break;case tv:if(e.preventDefault(),this.rowElements.length===0){this.focusOnCell(0,0,!1);break}if(this.focusRowIndex>=i||o.offsetTop+o.offsetHeight<=r){this.focusOnCell(i,this.focusColumnIndex,!1);return}for(n=this.focusRowIndex+1,n;n<=i;n++){const s=this.rowElements[n];if(s.offsetTop+s.offsetHeight>r){let l=0;this.generateHeader===Qr.sticky&&this.generatedHeader!==null&&(l=this.generatedHeader.clientHeight),this.scrollTop=s.offsetTop-l;break}}this.focusOnCell(n,this.focusColumnIndex,!1);break;case ai:e.ctrlKey&&(e.preventDefault(),this.focusOnCell(0,0,!0));break;case ui:e.ctrlKey&&this.columnDefinitions!==null&&(e.preventDefault(),this.focusOnCell(this.rowElements.length-1,this.columnDefinitions.length-1,!0));break}}queueFocusUpdate(){this.isUpdatingFocus&&(this.contains(document.activeElement)||this===document.activeElement)||this.pendingFocusUpdate===!1&&(this.pendingFocusUpdate=!0,B.queueUpdate(()=>this.updateFocus()))}updateFocus(){this.pendingFocusUpdate=!1,this.focusOnCell(this.focusRowIndex,this.focusColumnIndex,!0)}toggleGeneratedHeader(){if(this.generatedHeader!==null&&(this.removeChild(this.generatedHeader),this.generatedHeader=null),this.generateHeader!==Qr.none&&this.rowsData.length>0){const e=document.createElement(this.rowElementTag);this.generatedHeader=e,this.generatedHeader.columnDefinitions=this.columnDefinitions,this.generatedHeader.gridTemplateColumns=this.gridTemplateColumns,this.generatedHeader.rowType=this.generateHeader===Qr.sticky?Zi.stickyHeader:Zi.header,(this.firstChild!==null||this.rowsPlaceholder!==null)&&this.insertBefore(e,this.firstChild!==null?this.firstChild:this.rowsPlaceholder);return}}}ie.generateColumns=t=>Object.getOwnPropertyNames(t).map((e,n)=>({columnDataKey:e,gridColumn:`${n}`}));m([b({attribute:"no-tabbing",mode:"boolean"})],ie.prototype,"noTabbing",void 0);m([b({attribute:"generate-header"})],ie.prototype,"generateHeader",void 0);m([b({attribute:"grid-template-columns"})],ie.prototype,"gridTemplateColumns",void 0);m([I],ie.prototype,"rowsData",void 0);m([I],ie.prototype,"columnDefinitions",void 0);m([I],ie.prototype,"rowItemTemplate",void 0);m([I],ie.prototype,"cellItemTemplate",void 0);m([I],ie.prototype,"headerCellItemTemplate",void 0);m([I],ie.prototype,"focusRowIndex",void 0);m([I],ie.prototype,"focusColumnIndex",void 0);m([I],ie.prototype,"defaultRowItemTemplate",void 0);m([I],ie.prototype,"rowElementTag",void 0);m([I],ie.prototype,"rowElements",void 0);const fv=V`
    <template>
        ${t=>t.rowData===null||t.columnDefinition===null||t.columnDefinition.columnDataKey===null?null:t.rowData[t.columnDefinition.columnDataKey]}
    </template>
`,pv=V`
    <template>
        ${t=>t.columnDefinition===null?null:t.columnDefinition.title===void 0?t.columnDefinition.columnDataKey:t.columnDefinition.title}
    </template>
`;class jt extends q{constructor(){super(...arguments),this.cellType=bt.default,this.rowData=null,this.columnDefinition=null,this.isActiveCell=!1,this.customCellView=null,this.updateCellStyle=()=>{this.style.gridColumn=this.gridColumn}}cellTypeChanged(){this.$fastController.isConnected&&this.updateCellView()}gridColumnChanged(){this.$fastController.isConnected&&this.updateCellStyle()}columnDefinitionChanged(e,n){this.$fastController.isConnected&&this.updateCellView()}connectedCallback(){var e;super.connectedCallback(),this.addEventListener(Mc,this.handleFocusin),this.addEventListener(Yn,this.handleFocusout),this.addEventListener(Xn,this.handleKeydown),this.style.gridColumn=`${((e=this.columnDefinition)===null||e===void 0?void 0:e.gridColumn)===void 0?0:this.columnDefinition.gridColumn}`,this.updateCellView(),this.updateCellStyle()}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener(Mc,this.handleFocusin),this.removeEventListener(Yn,this.handleFocusout),this.removeEventListener(Xn,this.handleKeydown),this.disconnectCellView()}handleFocusin(e){if(!this.isActiveCell){switch(this.isActiveCell=!0,this.cellType){case bt.columnHeader:if(this.columnDefinition!==null&&this.columnDefinition.headerCellInternalFocusQueue!==!0&&typeof this.columnDefinition.headerCellFocusTargetCallback=="function"){const n=this.columnDefinition.headerCellFocusTargetCallback(this);n!==null&&n.focus()}break;default:if(this.columnDefinition!==null&&this.columnDefinition.cellInternalFocusQueue!==!0&&typeof this.columnDefinition.cellFocusTargetCallback=="function"){const n=this.columnDefinition.cellFocusTargetCallback(this);n!==null&&n.focus()}break}this.$emit("cell-focused",this)}}handleFocusout(e){this!==document.activeElement&&!this.contains(document.activeElement)&&(this.isActiveCell=!1)}handleKeydown(e){if(!(e.defaultPrevented||this.columnDefinition===null||this.cellType===bt.default&&this.columnDefinition.cellInternalFocusQueue!==!0||this.cellType===bt.columnHeader&&this.columnDefinition.headerCellInternalFocusQueue!==!0))switch(e.key){case $r:case ev:if(this.contains(document.activeElement)&&document.activeElement!==this)return;switch(this.cellType){case bt.columnHeader:if(this.columnDefinition.headerCellFocusTargetCallback!==void 0){const n=this.columnDefinition.headerCellFocusTargetCallback(this);n!==null&&n.focus(),e.preventDefault()}break;default:if(this.columnDefinition.cellFocusTargetCallback!==void 0){const n=this.columnDefinition.cellFocusTargetCallback(this);n!==null&&n.focus(),e.preventDefault()}break}break;case ts:this.contains(document.activeElement)&&document.activeElement!==this&&(this.focus(),e.preventDefault());break}}updateCellView(){if(this.disconnectCellView(),this.columnDefinition!==null)switch(this.cellType){case bt.columnHeader:this.columnDefinition.headerCellTemplate!==void 0?this.customCellView=this.columnDefinition.headerCellTemplate.render(this,this):this.customCellView=pv.render(this,this);break;case void 0:case bt.rowHeader:case bt.default:this.columnDefinition.cellTemplate!==void 0?this.customCellView=this.columnDefinition.cellTemplate.render(this,this):this.customCellView=fv.render(this,this);break}}disconnectCellView(){this.customCellView!==null&&(this.customCellView.dispose(),this.customCellView=null)}}m([b({attribute:"cell-type"})],jt.prototype,"cellType",void 0);m([b({attribute:"grid-column"})],jt.prototype,"gridColumn",void 0);m([I],jt.prototype,"rowData",void 0);m([I],jt.prototype,"columnDefinition",void 0);function mv(t){const e=t.tagFor(jt);return V`
    <${e}
        cell-type="${n=>n.isRowHeader?"rowheader":void 0}"
        grid-column="${(n,i)=>i.index+1}"
        :rowData="${(n,i)=>i.parent.rowData}"
        :columnDefinition="${n=>n}"
    ></${e}>
`}function gv(t){const e=t.tagFor(jt);return V`
    <${e}
        cell-type="columnheader"
        grid-column="${(n,i)=>i.index+1}"
        :columnDefinition="${n=>n}"
    ></${e}>
`}const vv=(t,e)=>{const n=mv(t),i=gv(t);return V`
        <template
            role="row"
            class="${r=>r.rowType!=="default"?r.rowType:""}"
            :defaultCellItemTemplate="${n}"
            :defaultHeaderCellItemTemplate="${i}"
            ${pf({property:"cellElements",filter:Ua('[role="cell"],[role="gridcell"],[role="columnheader"],[role="rowheader"]')})}
        >
            <slot ${Qe("slottedCellElements")}></slot>
        </template>
    `},yv=(t,e)=>V`
        <template
            tabindex="-1"
            role="${n=>!n.cellType||n.cellType==="default"?"gridcell":n.cellType}"
            class="
            ${n=>n.cellType==="columnheader"?"column-header":n.cellType==="rowheader"?"row-header":""}
            "
        >
            <slot></slot>
        </template>
    `,bv=(t,e)=>V`
    <template
        role="checkbox"
        aria-checked="${n=>n.checked}"
        aria-required="${n=>n.required}"
        aria-disabled="${n=>n.disabled}"
        aria-readonly="${n=>n.readOnly}"
        tabindex="${n=>n.disabled?null:0}"
        @keypress="${(n,i)=>n.keypressHandler(i.event)}"
        @click="${(n,i)=>n.clickHandler(i.event)}"
        class="${n=>n.readOnly?"readonly":""} ${n=>n.checked?"checked":""} ${n=>n.indeterminate?"indeterminate":""}"
    >
        <div part="control" class="control">
            <slot name="checked-indicator">
                ${e.checkedIndicator||""}
            </slot>
            <slot name="indeterminate-indicator">
                ${e.indeterminateIndicator||""}
            </slot>
        </div>
        <label
            part="label"
            class="${n=>n.defaultSlottedNodes&&n.defaultSlottedNodes.length?"label":"label label__hidden"}"
        >
            <slot ${Qe("defaultSlottedNodes")}></slot>
        </label>
    </template>
`;class wv extends q{}class xv extends xf(wv){constructor(){super(...arguments),this.proxy=document.createElement("input")}}class is extends xv{constructor(){super(),this.initialValue="on",this.indeterminate=!1,this.keypressHandler=e=>{if(!this.readOnly)switch(e.key){case Sr:this.indeterminate&&(this.indeterminate=!1),this.checked=!this.checked;break}},this.clickHandler=e=>{!this.disabled&&!this.readOnly&&(this.indeterminate&&(this.indeterminate=!1),this.checked=!this.checked)},this.proxy.setAttribute("type","checkbox")}readOnlyChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.readOnly=this.readOnly)}}m([b({attribute:"readonly",mode:"boolean"})],is.prototype,"readOnly",void 0);m([I],is.prototype,"defaultSlottedNodes",void 0);m([I],is.prototype,"indeterminate",void 0);function kf(t){return Zg(t)&&(t.getAttribute("role")==="option"||t instanceof HTMLOptionElement)}class vt extends q{constructor(e,n,i,r){super(),this.defaultSelected=!1,this.dirtySelected=!1,this.selected=this.defaultSelected,this.dirtyValue=!1,e&&(this.textContent=e),n&&(this.initialValue=n),i&&(this.defaultSelected=i),r&&(this.selected=r),this.proxy=new Option(`${this.textContent}`,this.initialValue,this.defaultSelected,this.selected),this.proxy.disabled=this.disabled}checkedChanged(e,n){if(typeof n=="boolean"){this.ariaChecked=n?"true":"false";return}this.ariaChecked=null}contentChanged(e,n){this.proxy instanceof HTMLOptionElement&&(this.proxy.textContent=this.textContent),this.$emit("contentchange",null,{bubbles:!0})}defaultSelectedChanged(){this.dirtySelected||(this.selected=this.defaultSelected,this.proxy instanceof HTMLOptionElement&&(this.proxy.selected=this.defaultSelected))}disabledChanged(e,n){this.ariaDisabled=this.disabled?"true":"false",this.proxy instanceof HTMLOptionElement&&(this.proxy.disabled=this.disabled)}selectedAttributeChanged(){this.defaultSelected=this.selectedAttribute,this.proxy instanceof HTMLOptionElement&&(this.proxy.defaultSelected=this.defaultSelected)}selectedChanged(){this.ariaSelected=this.selected?"true":"false",this.dirtySelected||(this.dirtySelected=!0),this.proxy instanceof HTMLOptionElement&&(this.proxy.selected=this.selected)}initialValueChanged(e,n){this.dirtyValue||(this.value=this.initialValue,this.dirtyValue=!1)}get label(){var e;return(e=this.value)!==null&&e!==void 0?e:this.text}get text(){var e,n;return(n=(e=this.textContent)===null||e===void 0?void 0:e.replace(/\s+/g," ").trim())!==null&&n!==void 0?n:""}set value(e){const n=`${e!=null?e:""}`;this._value=n,this.dirtyValue=!0,this.proxy instanceof HTMLOptionElement&&(this.proxy.value=n),F.notify(this,"value")}get value(){var e;return F.track(this,"value"),(e=this._value)!==null&&e!==void 0?e:this.text}get form(){return this.proxy?this.proxy.form:null}}m([I],vt.prototype,"checked",void 0);m([I],vt.prototype,"content",void 0);m([I],vt.prototype,"defaultSelected",void 0);m([b({mode:"boolean"})],vt.prototype,"disabled",void 0);m([b({attribute:"selected",mode:"boolean"})],vt.prototype,"selectedAttribute",void 0);m([I],vt.prototype,"selected",void 0);m([b({attribute:"value",mode:"fromView"})],vt.prototype,"initialValue",void 0);class ci{}m([I],ci.prototype,"ariaChecked",void 0);m([I],ci.prototype,"ariaPosInSet",void 0);m([I],ci.prototype,"ariaSelected",void 0);m([I],ci.prototype,"ariaSetSize",void 0);Le(ci,G);Le(vt,oi,ci);class $e extends q{constructor(){super(...arguments),this._options=[],this.selectedIndex=-1,this.selectedOptions=[],this.shouldSkipFocus=!1,this.typeaheadBuffer="",this.typeaheadExpired=!0,this.typeaheadTimeout=-1}get firstSelectedOption(){var e;return(e=this.selectedOptions[0])!==null&&e!==void 0?e:null}get hasSelectableOptions(){return this.options.length>0&&!this.options.every(e=>e.disabled)}get length(){var e,n;return(n=(e=this.options)===null||e===void 0?void 0:e.length)!==null&&n!==void 0?n:0}get options(){return F.track(this,"options"),this._options}set options(e){this._options=e,F.notify(this,"options")}get typeAheadExpired(){return this.typeaheadExpired}set typeAheadExpired(e){this.typeaheadExpired=e}clickHandler(e){const n=e.target.closest("option,[role=option]");if(n&&!n.disabled)return this.selectedIndex=this.options.indexOf(n),!0}focusAndScrollOptionIntoView(e=this.firstSelectedOption){this.contains(document.activeElement)&&e!==null&&(e.focus(),requestAnimationFrame(()=>{e.scrollIntoView({block:"nearest"})}))}focusinHandler(e){!this.shouldSkipFocus&&e.target===e.currentTarget&&(this.setSelectedOptions(),this.focusAndScrollOptionIntoView()),this.shouldSkipFocus=!1}getTypeaheadMatches(){const e=this.typeaheadBuffer.replace(/[.*+\-?^${}()|[\]\\]/g,"\\$&"),n=new RegExp(`^${e}`,"gi");return this.options.filter(i=>i.text.trim().match(n))}getSelectableIndex(e=this.selectedIndex,n){const i=e>n?-1:e<n?1:0,r=e+i;let o=null;switch(i){case-1:{o=this.options.reduceRight((s,l,a)=>!s&&!l.disabled&&a<r?l:s,o);break}case 1:{o=this.options.reduce((s,l,a)=>!s&&!l.disabled&&a>r?l:s,o);break}}return this.options.indexOf(o)}handleChange(e,n){switch(n){case"selected":{$e.slottedOptionFilter(e)&&(this.selectedIndex=this.options.indexOf(e)),this.setSelectedOptions();break}}}handleTypeAhead(e){this.typeaheadTimeout&&window.clearTimeout(this.typeaheadTimeout),this.typeaheadTimeout=window.setTimeout(()=>this.typeaheadExpired=!0,$e.TYPE_AHEAD_TIMEOUT_MS),!(e.length>1)&&(this.typeaheadBuffer=`${this.typeaheadExpired?"":this.typeaheadBuffer}${e}`)}keydownHandler(e){if(this.disabled)return!0;this.shouldSkipFocus=!1;const n=e.key;switch(n){case ai:{e.shiftKey||(e.preventDefault(),this.selectFirstOption());break}case mn:{e.shiftKey||(e.preventDefault(),this.selectNextOption());break}case gn:{e.shiftKey||(e.preventDefault(),this.selectPreviousOption());break}case ui:{e.preventDefault(),this.selectLastOption();break}case Qa:return this.focusAndScrollOptionIntoView(),!0;case $r:case ts:return!0;case Sr:if(this.typeaheadExpired)return!0;default:return n.length===1&&this.handleTypeAhead(`${n}`),!0}}mousedownHandler(e){return this.shouldSkipFocus=!this.contains(document.activeElement),!0}multipleChanged(e,n){this.ariaMultiSelectable=n?"true":null}selectedIndexChanged(e,n){var i;if(!this.hasSelectableOptions){this.selectedIndex=-1;return}if(((i=this.options[this.selectedIndex])===null||i===void 0?void 0:i.disabled)&&typeof e=="number"){const r=this.getSelectableIndex(e,n),o=r>-1?r:e;this.selectedIndex=o,n===o&&this.selectedIndexChanged(n,o);return}this.setSelectedOptions()}selectedOptionsChanged(e,n){var i;const r=n.filter($e.slottedOptionFilter);(i=this.options)===null||i===void 0||i.forEach(o=>{const s=F.getNotifier(o);s.unsubscribe(this,"selected"),o.selected=r.includes(o),s.subscribe(this,"selected")})}selectFirstOption(){var e,n;this.disabled||(this.selectedIndex=(n=(e=this.options)===null||e===void 0?void 0:e.findIndex(i=>!i.disabled))!==null&&n!==void 0?n:-1)}selectLastOption(){this.disabled||(this.selectedIndex=Yg(this.options,e=>!e.disabled))}selectNextOption(){!this.disabled&&this.selectedIndex<this.options.length-1&&(this.selectedIndex+=1)}selectPreviousOption(){!this.disabled&&this.selectedIndex>0&&(this.selectedIndex=this.selectedIndex-1)}setDefaultSelectedOption(){var e,n;this.selectedIndex=(n=(e=this.options)===null||e===void 0?void 0:e.findIndex(i=>i.defaultSelected))!==null&&n!==void 0?n:-1}setSelectedOptions(){var e,n,i;!((e=this.options)===null||e===void 0)&&e.length&&(this.selectedOptions=[this.options[this.selectedIndex]],this.ariaActiveDescendant=(i=(n=this.firstSelectedOption)===null||n===void 0?void 0:n.id)!==null&&i!==void 0?i:"",this.focusAndScrollOptionIntoView())}slottedOptionsChanged(e,n){this.options=n.reduce((r,o)=>(kf(o)&&r.push(o),r),[]);const i=`${this.options.length}`;this.options.forEach((r,o)=>{r.id||(r.id=No("option-")),r.ariaPosInSet=`${o+1}`,r.ariaSetSize=i}),this.$fastController.isConnected&&(this.setSelectedOptions(),this.setDefaultSelectedOption())}typeaheadBufferChanged(e,n){if(this.$fastController.isConnected){const i=this.getTypeaheadMatches();if(i.length){const r=this.options.indexOf(i[0]);r>-1&&(this.selectedIndex=r)}this.typeaheadExpired=!1}}}$e.slottedOptionFilter=t=>kf(t)&&!t.hidden;$e.TYPE_AHEAD_TIMEOUT_MS=1e3;m([b({mode:"boolean"})],$e.prototype,"disabled",void 0);m([I],$e.prototype,"selectedIndex",void 0);m([I],$e.prototype,"selectedOptions",void 0);m([I],$e.prototype,"slottedOptions",void 0);m([I],$e.prototype,"typeaheadBuffer",void 0);class vn{}m([I],vn.prototype,"ariaActiveDescendant",void 0);m([I],vn.prototype,"ariaDisabled",void 0);m([I],vn.prototype,"ariaExpanded",void 0);m([I],vn.prototype,"ariaMultiSelectable",void 0);Le(vn,G);Le($e,vn);const Us={above:"above",below:"below"};function Bl(t){const e=t.parentElement;if(e)return e;{const n=t.getRootNode();if(n.host instanceof HTMLElement)return n.host}return null}function kv(t,e){let n=e;for(;n!==null;){if(n===t)return!0;n=Bl(n)}return!1}const ft=document.createElement("div");function Cv(t){return t instanceof es}class Ga{setProperty(e,n){B.queueUpdate(()=>this.target.setProperty(e,n))}removeProperty(e){B.queueUpdate(()=>this.target.removeProperty(e))}}class $v extends Ga{constructor(e){super();const n=new CSSStyleSheet;this.target=n.cssRules[n.insertRule(":host{}")].style,e.$fastController.addStyles(Ae.create([n]))}}class Sv extends Ga{constructor(){super();const e=new CSSStyleSheet;this.target=e.cssRules[e.insertRule(":root{}")].style,document.adoptedStyleSheets=[...document.adoptedStyleSheets,e]}}class Ev extends Ga{constructor(){super(),this.style=document.createElement("style"),document.head.appendChild(this.style);const{sheet:e}=this.style;if(e){const n=e.insertRule(":root{}",e.cssRules.length);this.target=e.cssRules[n].style}}}class Cf{constructor(e){this.store=new Map,this.target=null;const n=e.$fastController;this.style=document.createElement("style"),n.addStyles(this.style),F.getNotifier(n).subscribe(this,"isConnected"),this.handleChange(n,"isConnected")}targetChanged(){if(this.target!==null)for(const[e,n]of this.store.entries())this.target.setProperty(e,n)}setProperty(e,n){this.store.set(e,n),B.queueUpdate(()=>{this.target!==null&&this.target.setProperty(e,n)})}removeProperty(e){this.store.delete(e),B.queueUpdate(()=>{this.target!==null&&this.target.removeProperty(e)})}handleChange(e,n){const{sheet:i}=this.style;if(i){const r=i.insertRule(":host{}",i.cssRules.length);this.target=i.cssRules[r].style}else this.target=null}}m([I],Cf.prototype,"target",void 0);class Tv{constructor(e){this.target=e.style}setProperty(e,n){B.queueUpdate(()=>this.target.setProperty(e,n))}removeProperty(e){B.queueUpdate(()=>this.target.removeProperty(e))}}class se{setProperty(e,n){se.properties[e]=n;for(const i of se.roots.values())Rn.getOrCreate(se.normalizeRoot(i)).setProperty(e,n)}removeProperty(e){delete se.properties[e];for(const n of se.roots.values())Rn.getOrCreate(se.normalizeRoot(n)).removeProperty(e)}static registerRoot(e){const{roots:n}=se;if(!n.has(e)){n.add(e);const i=Rn.getOrCreate(this.normalizeRoot(e));for(const r in se.properties)i.setProperty(r,se.properties[r])}}static unregisterRoot(e){const{roots:n}=se;if(n.has(e)){n.delete(e);const i=Rn.getOrCreate(se.normalizeRoot(e));for(const r in se.properties)i.removeProperty(r)}}static normalizeRoot(e){return e===ft?document:e}}se.roots=new Set;se.properties={};const Ws=new WeakMap,Iv=B.supportsAdoptedStyleSheets?$v:Cf,Rn=Object.freeze({getOrCreate(t){if(Ws.has(t))return Ws.get(t);let e;return t===ft?e=new se:t instanceof Document?e=B.supportsAdoptedStyleSheets?new Sv:new Ev:Cv(t)?e=new Iv(t):e=new Tv(t),Ws.set(t,e),e}});class ke extends lf{constructor(e){super(),this.subscribers=new WeakMap,this._appliedTo=new Set,this.name=e.name,e.cssCustomPropertyName!==null&&(this.cssCustomProperty=`--${e.cssCustomPropertyName}`,this.cssVar=`var(${this.cssCustomProperty})`),this.id=ke.uniqueId(),ke.tokensById.set(this.id,this)}get appliedTo(){return[...this._appliedTo]}static from(e){return new ke({name:typeof e=="string"?e:e.name,cssCustomPropertyName:typeof e=="string"?e:e.cssCustomPropertyName===void 0?e.name:e.cssCustomPropertyName})}static isCSSDesignToken(e){return typeof e.cssCustomProperty=="string"}static isDerivedDesignTokenValue(e){return typeof e=="function"}static getTokenById(e){return ke.tokensById.get(e)}getOrCreateSubscriberSet(e=this){return this.subscribers.get(e)||this.subscribers.set(e,new Set)&&this.subscribers.get(e)}createCSS(){return this.cssVar||""}getValueFor(e){const n=ee.getOrCreate(e).get(this);if(n!==void 0)return n;throw new Error(`Value could not be retrieved for token named "${this.name}". Ensure the value is set for ${e} or an ancestor of ${e}.`)}setValueFor(e,n){return this._appliedTo.add(e),n instanceof ke&&(n=this.alias(n)),ee.getOrCreate(e).set(this,n),this}deleteValueFor(e){return this._appliedTo.delete(e),ee.existsFor(e)&&ee.getOrCreate(e).delete(this),this}withDefault(e){return this.setValueFor(ft,e),this}subscribe(e,n){const i=this.getOrCreateSubscriberSet(n);n&&!ee.existsFor(n)&&ee.getOrCreate(n),i.has(e)||i.add(e)}unsubscribe(e,n){const i=this.subscribers.get(n||this);i&&i.has(e)&&i.delete(e)}notify(e){const n=Object.freeze({token:this,target:e});this.subscribers.has(this)&&this.subscribers.get(this).forEach(i=>i.handleChange(n)),this.subscribers.has(e)&&this.subscribers.get(e).forEach(i=>i.handleChange(n))}alias(e){return n=>e.getValueFor(n)}}ke.uniqueId=(()=>{let t=0;return()=>(t++,t.toString(16))})();ke.tokensById=new Map;class Ov{startReflection(e,n){e.subscribe(this,n),this.handleChange({token:e,target:n})}stopReflection(e,n){e.unsubscribe(this,n),this.remove(e,n)}handleChange(e){const{token:n,target:i}=e;this.add(n,i)}add(e,n){Rn.getOrCreate(n).setProperty(e.cssCustomProperty,this.resolveCSSValue(ee.getOrCreate(n).get(e)))}remove(e,n){Rn.getOrCreate(n).removeProperty(e.cssCustomProperty)}resolveCSSValue(e){return e&&typeof e.createCSS=="function"?e.createCSS():e}}class Rv{constructor(e,n,i){this.source=e,this.token=n,this.node=i,this.dependencies=new Set,this.observer=F.binding(e,this,!1),this.observer.handleChange=this.observer.call,this.handleChange()}disconnect(){this.observer.disconnect()}handleChange(){this.node.store.set(this.token,this.observer.observe(this.node.target,Yi))}}class Pv{constructor(){this.values=new Map}set(e,n){this.values.get(e)!==n&&(this.values.set(e,n),F.getNotifier(this).notify(e.id))}get(e){return F.track(this,e.id),this.values.get(e)}delete(e){this.values.delete(e)}all(){return this.values.entries()}}const Ii=new WeakMap,Oi=new WeakMap;class ee{constructor(e){this.target=e,this.store=new Pv,this.children=[],this.assignedValues=new Map,this.reflecting=new Set,this.bindingObservers=new Map,this.tokenValueChangeHandler={handleChange:(n,i)=>{const r=ke.getTokenById(i);if(r&&(r.notify(this.target),ke.isCSSDesignToken(r))){const o=this.parent,s=this.isReflecting(r);if(o){const l=o.get(r),a=n.get(r);l!==a&&!s?this.reflectToCSS(r):l===a&&s&&this.stopReflectToCSS(r)}else s||this.reflectToCSS(r)}}},Ii.set(e,this),F.getNotifier(this.store).subscribe(this.tokenValueChangeHandler),e instanceof es?e.$fastController.addBehaviors([this]):e.isConnected&&this.bind()}static getOrCreate(e){return Ii.get(e)||new ee(e)}static existsFor(e){return Ii.has(e)}static findParent(e){if(ft!==e.target){let n=Bl(e.target);for(;n!==null;){if(Ii.has(n))return Ii.get(n);n=Bl(n)}return ee.getOrCreate(ft)}return null}static findClosestAssignedNode(e,n){let i=n;do{if(i.has(e))return i;i=i.parent?i.parent:i.target!==ft?ee.getOrCreate(ft):null}while(i!==null);return null}get parent(){return Oi.get(this)||null}has(e){return this.assignedValues.has(e)}get(e){const n=this.store.get(e);if(n!==void 0)return n;const i=this.getRaw(e);if(i!==void 0)return this.hydrate(e,i),this.get(e)}getRaw(e){var n;return this.assignedValues.has(e)?this.assignedValues.get(e):(n=ee.findClosestAssignedNode(e,this))===null||n===void 0?void 0:n.getRaw(e)}set(e,n){ke.isDerivedDesignTokenValue(this.assignedValues.get(e))&&this.tearDownBindingObserver(e),this.assignedValues.set(e,n),ke.isDerivedDesignTokenValue(n)?this.setupBindingObserver(e,n):this.store.set(e,n)}delete(e){this.assignedValues.delete(e),this.tearDownBindingObserver(e);const n=this.getRaw(e);n?this.hydrate(e,n):this.store.delete(e)}bind(){const e=ee.findParent(this);e&&e.appendChild(this);for(const n of this.assignedValues.keys())n.notify(this.target)}unbind(){this.parent&&Oi.get(this).removeChild(this)}appendChild(e){e.parent&&Oi.get(e).removeChild(e);const n=this.children.filter(i=>e.contains(i));Oi.set(e,this),this.children.push(e),n.forEach(i=>e.appendChild(i)),F.getNotifier(this.store).subscribe(e);for(const[i,r]of this.store.all())e.hydrate(i,this.bindingObservers.has(i)?this.getRaw(i):r)}removeChild(e){const n=this.children.indexOf(e);return n!==-1&&this.children.splice(n,1),F.getNotifier(this.store).unsubscribe(e),e.parent===this?Oi.delete(e):!1}contains(e){return kv(this.target,e.target)}reflectToCSS(e){this.isReflecting(e)||(this.reflecting.add(e),ee.cssCustomPropertyReflector.startReflection(e,this.target))}stopReflectToCSS(e){this.isReflecting(e)&&(this.reflecting.delete(e),ee.cssCustomPropertyReflector.stopReflection(e,this.target))}isReflecting(e){return this.reflecting.has(e)}handleChange(e,n){const i=ke.getTokenById(n);!i||this.hydrate(i,this.getRaw(i))}hydrate(e,n){if(!this.has(e)){const i=this.bindingObservers.get(e);ke.isDerivedDesignTokenValue(n)?i?i.source!==n&&(this.tearDownBindingObserver(e),this.setupBindingObserver(e,n)):this.setupBindingObserver(e,n):(i&&this.tearDownBindingObserver(e),this.store.set(e,n))}}setupBindingObserver(e,n){const i=new Rv(n,e,this);return this.bindingObservers.set(e,i),i}tearDownBindingObserver(e){return this.bindingObservers.has(e)?(this.bindingObservers.get(e).disconnect(),this.bindingObservers.delete(e),!0):!1}}ee.cssCustomPropertyReflector=new Ov;m([I],ee.prototype,"children",void 0);function Dv(t){return ke.from(t)}const $f=Object.freeze({create:Dv,notifyConnection(t){return!t.isConnected||!ee.existsFor(t)?!1:(ee.getOrCreate(t).bind(),!0)},notifyDisconnection(t){return t.isConnected||!ee.existsFor(t)?!1:(ee.getOrCreate(t).unbind(),!0)},registerRoot(t=ft){se.registerRoot(t)},unregisterRoot(t=ft){se.unregisterRoot(t)}}),Qs=Object.freeze({definitionCallbackOnly:null,ignoreDuplicate:Symbol()}),qs=new Map,lo=new Map;let Hn=null;const Ri=Y.createInterface(t=>t.cachedCallback(e=>(Hn===null&&(Hn=new Ef(null,e)),Hn))),Sf=Object.freeze({tagFor(t){return lo.get(t)},responsibleFor(t){const e=t.$$designSystem$$;return e||Y.findResponsibleContainer(t).get(Ri)},getOrCreate(t){if(!t)return Hn===null&&(Hn=Y.getOrCreateDOMContainer().get(Ri)),Hn;const e=t.$$designSystem$$;if(e)return e;const n=Y.getOrCreateDOMContainer(t);if(n.has(Ri,!1))return n.get(Ri);{const i=new Ef(t,n);return n.register(pr.instance(Ri,i)),i}}});function Av(t,e,n){return typeof t=="string"?{name:t,type:e,callback:n}:t}class Ef{constructor(e,n){this.owner=e,this.container=n,this.designTokensInitialized=!1,this.prefix="fast",this.shadowRootMode=void 0,this.disambiguate=()=>Qs.definitionCallbackOnly,e!==null&&(e.$$designSystem$$=this)}withPrefix(e){return this.prefix=e,this}withShadowRootMode(e){return this.shadowRootMode=e,this}withElementDisambiguation(e){return this.disambiguate=e,this}withDesignTokenRoot(e){return this.designTokenRoot=e,this}register(...e){const n=this.container,i=[],r=this.disambiguate,o=this.shadowRootMode,s={elementPrefix:this.prefix,tryDefineElement(l,a,u){const h=Av(l,a,u),{name:g,callback:p,baseClass:w}=h;let{type:k}=h,$=g,f=qs.get($),c=!0;for(;f;){const d=r($,k,f);switch(d){case Qs.ignoreDuplicate:return;case Qs.definitionCallbackOnly:c=!1,f=void 0;break;default:$=d,f=qs.get($);break}}c&&((lo.has(k)||k===q)&&(k=class extends k{}),qs.set($,k),lo.set(k,$),w&&lo.set(w,$)),i.push(new _v(n,$,k,o,p,c))}};this.designTokensInitialized||(this.designTokensInitialized=!0,this.designTokenRoot!==null&&$f.registerRoot(this.designTokenRoot)),n.registerWithContext(s,...e);for(const l of i)l.callback(l),l.willDefine&&l.definition!==null&&l.definition.define();return this}}class _v{constructor(e,n,i,r,o,s){this.container=e,this.name=n,this.type=i,this.shadowRootMode=r,this.callback=o,this.willDefine=s,this.definition=null}definePresentation(e){yf.define(this.name,e,this.container)}defineElement(e){this.definition=new Cr(this.type,Object.assign(Object.assign({},e),{name:this.name}))}tagFor(e){return Sf.tagFor(e)}}const Lv=(t,e)=>V`
    <template role="${n=>n.role}" aria-orientation="${n=>n.orientation}"></template>
`,Nv={separator:"separator",presentation:"presentation"};class Ya extends q{constructor(){super(...arguments),this.role=Nv.separator,this.orientation=Wa.horizontal}}m([b],Ya.prototype,"role",void 0);m([b],Ya.prototype,"orientation",void 0);const Fv=(t,e)=>V`
    <template
        aria-checked="${n=>n.ariaChecked}"
        aria-disabled="${n=>n.ariaDisabled}"
        aria-posinset="${n=>n.ariaPosInSet}"
        aria-selected="${n=>n.ariaSelected}"
        aria-setsize="${n=>n.ariaSetSize}"
        class="${n=>[n.checked&&"checked",n.selected&&"selected",n.disabled&&"disabled"].filter(Boolean).join(" ")}"
        role="option"
    >
        ${li(t,e)}
        <span class="content" part="content">
            <slot ${Qe("content")}></slot>
        </span>
        ${si(t,e)}
    </template>
`;class rs extends $e{constructor(){super(...arguments),this.activeIndex=-1,this.rangeStartIndex=-1}get activeOption(){return this.options[this.activeIndex]}get checkedOptions(){var e;return(e=this.options)===null||e===void 0?void 0:e.filter(n=>n.checked)}get firstSelectedOptionIndex(){return this.options.indexOf(this.firstSelectedOption)}activeIndexChanged(e,n){var i,r;this.ariaActiveDescendant=(r=(i=this.options[n])===null||i===void 0?void 0:i.id)!==null&&r!==void 0?r:"",this.focusAndScrollOptionIntoView()}checkActiveIndex(){if(!this.multiple)return;const e=this.activeOption;e&&(e.checked=!0)}checkFirstOption(e=!1){e?(this.rangeStartIndex===-1&&(this.rangeStartIndex=this.activeIndex+1),this.options.forEach((n,i)=>{n.checked=Wr(i,this.rangeStartIndex)})):this.uncheckAllOptions(),this.activeIndex=0,this.checkActiveIndex()}checkLastOption(e=!1){e?(this.rangeStartIndex===-1&&(this.rangeStartIndex=this.activeIndex),this.options.forEach((n,i)=>{n.checked=Wr(i,this.rangeStartIndex,this.options.length)})):this.uncheckAllOptions(),this.activeIndex=this.options.length-1,this.checkActiveIndex()}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this.focusoutHandler)}disconnectedCallback(){this.removeEventListener("focusout",this.focusoutHandler),super.disconnectedCallback()}checkNextOption(e=!1){e?(this.rangeStartIndex===-1&&(this.rangeStartIndex=this.activeIndex),this.options.forEach((n,i)=>{n.checked=Wr(i,this.rangeStartIndex,this.activeIndex+1)})):this.uncheckAllOptions(),this.activeIndex+=this.activeIndex<this.options.length-1?1:0,this.checkActiveIndex()}checkPreviousOption(e=!1){e?(this.rangeStartIndex===-1&&(this.rangeStartIndex=this.activeIndex),this.checkedOptions.length===1&&(this.rangeStartIndex+=1),this.options.forEach((n,i)=>{n.checked=Wr(i,this.activeIndex,this.rangeStartIndex)})):this.uncheckAllOptions(),this.activeIndex-=this.activeIndex>0?1:0,this.checkActiveIndex()}clickHandler(e){var n;if(!this.multiple)return super.clickHandler(e);const i=(n=e.target)===null||n===void 0?void 0:n.closest("[role=option]");if(!(!i||i.disabled))return this.uncheckAllOptions(),this.activeIndex=this.options.indexOf(i),this.checkActiveIndex(),this.toggleSelectedForAllCheckedOptions(),!0}focusAndScrollOptionIntoView(){super.focusAndScrollOptionIntoView(this.activeOption)}focusinHandler(e){if(!this.multiple)return super.focusinHandler(e);!this.shouldSkipFocus&&e.target===e.currentTarget&&(this.uncheckAllOptions(),this.activeIndex===-1&&(this.activeIndex=this.firstSelectedOptionIndex!==-1?this.firstSelectedOptionIndex:0),this.checkActiveIndex(),this.setSelectedOptions(),this.focusAndScrollOptionIntoView()),this.shouldSkipFocus=!1}focusoutHandler(e){this.multiple&&this.uncheckAllOptions()}keydownHandler(e){if(!this.multiple)return super.keydownHandler(e);if(this.disabled)return!0;const{key:n,shiftKey:i}=e;switch(this.shouldSkipFocus=!1,n){case ai:{this.checkFirstOption(i);return}case mn:{this.checkNextOption(i);return}case gn:{this.checkPreviousOption(i);return}case ui:{this.checkLastOption(i);return}case Qa:return this.focusAndScrollOptionIntoView(),!0;case ts:return this.uncheckAllOptions(),this.checkActiveIndex(),!0;case Sr:if(e.preventDefault(),this.typeAheadExpired){this.toggleSelectedForAllCheckedOptions();return}default:return n.length===1&&this.handleTypeAhead(`${n}`),!0}}mousedownHandler(e){if(e.offsetX>=0&&e.offsetX<=this.scrollWidth)return super.mousedownHandler(e)}multipleChanged(e,n){var i;this.ariaMultiSelectable=n?"true":null,(i=this.options)===null||i===void 0||i.forEach(r=>{r.checked=n?!1:void 0}),this.setSelectedOptions()}setSelectedOptions(){if(!this.multiple){super.setSelectedOptions();return}this.$fastController.isConnected&&this.options&&(this.selectedOptions=this.options.filter(e=>e.selected),this.focusAndScrollOptionIntoView())}sizeChanged(e,n){var i;const r=Math.max(0,parseInt((i=n==null?void 0:n.toFixed())!==null&&i!==void 0?i:"",10));r!==n&&B.queueUpdate(()=>{this.size=r})}toggleSelectedForAllCheckedOptions(){const e=this.checkedOptions.filter(i=>!i.disabled),n=!e.every(i=>i.selected);e.forEach(i=>i.selected=n),this.selectedIndex=this.options.indexOf(e[e.length-1]),this.setSelectedOptions()}typeaheadBufferChanged(e,n){if(!this.multiple){super.typeaheadBufferChanged(e,n);return}if(this.$fastController.isConnected){const i=this.getTypeaheadMatches(),r=this.options.indexOf(i[0]);r>-1&&(this.activeIndex=r,this.uncheckAllOptions(),this.checkActiveIndex()),this.typeAheadExpired=!1}}uncheckAllOptions(e=!1){this.options.forEach(n=>n.checked=this.multiple?!1:void 0),e||(this.rangeStartIndex=-1)}}m([I],rs.prototype,"activeIndex",void 0);m([b({mode:"boolean"})],rs.prototype,"multiple",void 0);m([b({converter:Ke})],rs.prototype,"size",void 0);class Bv extends q{}class Mv extends Tr(Bv){constructor(){super(...arguments),this.proxy=document.createElement("input")}}const zv={email:"email",password:"password",tel:"tel",text:"text",url:"url"};class Be extends Mv{constructor(){super(...arguments),this.type=zv.text}readOnlyChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.readOnly=this.readOnly,this.validate())}autofocusChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.autofocus=this.autofocus,this.validate())}placeholderChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.placeholder=this.placeholder)}typeChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.type=this.type,this.validate())}listChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.setAttribute("list",this.list),this.validate())}maxlengthChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.maxLength=this.maxlength,this.validate())}minlengthChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.minLength=this.minlength,this.validate())}patternChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.pattern=this.pattern,this.validate())}sizeChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.size=this.size)}spellcheckChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.spellcheck=this.spellcheck)}connectedCallback(){super.connectedCallback(),this.proxy.setAttribute("type",this.type),this.validate(),this.autofocus&&B.queueUpdate(()=>{this.focus()})}select(){this.control.select(),this.$emit("select")}handleTextInput(){this.value=this.control.value}handleChange(){this.$emit("change")}validate(){super.validate(this.control)}}m([b({attribute:"readonly",mode:"boolean"})],Be.prototype,"readOnly",void 0);m([b({mode:"boolean"})],Be.prototype,"autofocus",void 0);m([b],Be.prototype,"placeholder",void 0);m([b],Be.prototype,"type",void 0);m([b],Be.prototype,"list",void 0);m([b({converter:Ke})],Be.prototype,"maxlength",void 0);m([b({converter:Ke})],Be.prototype,"minlength",void 0);m([b],Be.prototype,"pattern",void 0);m([b({converter:Ke})],Be.prototype,"size",void 0);m([b({mode:"boolean"})],Be.prototype,"spellcheck",void 0);m([I],Be.prototype,"defaultSlottedNodes",void 0);class Xa{}Le(Xa,G);Le(Be,oi,Xa);const Wc=44,Vv=(t,e)=>V`
    <template
        role="progressbar"
        aria-valuenow="${n=>n.value}"
        aria-valuemin="${n=>n.min}"
        aria-valuemax="${n=>n.max}"
        class="${n=>n.paused?"paused":""}"
    >
        ${ja(n=>typeof n.value=="number",V`
                <svg
                    class="progress"
                    part="progress"
                    viewBox="0 0 16 16"
                    slot="determinate"
                >
                    <circle
                        class="background"
                        part="background"
                        cx="8px"
                        cy="8px"
                        r="7px"
                    ></circle>
                    <circle
                        class="determinate"
                        part="determinate"
                        style="stroke-dasharray: ${n=>Wc*n.percentComplete/100}px ${Wc}px"
                        cx="8px"
                        cy="8px"
                        r="7px"
                    ></circle>
                </svg>
            `,V`
                <slot name="indeterminate" slot="indeterminate">
                    ${e.indeterminateIndicator||""}
                </slot>
            `)}
    </template>
`;class di extends q{constructor(){super(...arguments),this.percentComplete=0}valueChanged(){this.$fastController.isConnected&&this.updatePercentComplete()}minChanged(){this.$fastController.isConnected&&this.updatePercentComplete()}maxChanged(){this.$fastController.isConnected&&this.updatePercentComplete()}connectedCallback(){super.connectedCallback(),this.updatePercentComplete()}updatePercentComplete(){const e=typeof this.min=="number"?this.min:0,n=typeof this.max=="number"?this.max:100,i=typeof this.value=="number"?this.value:0,r=n-e;this.percentComplete=r===0?0:Math.fround((i-e)/r*100)}}m([b({converter:Ke})],di.prototype,"value",void 0);m([b({converter:Ke})],di.prototype,"min",void 0);m([b({converter:Ke})],di.prototype,"max",void 0);m([b({mode:"boolean"})],di.prototype,"paused",void 0);m([I],di.prototype,"percentComplete",void 0);const Hv=(t,e)=>V`
    <template
        role="radiogroup"
        aria-disabled="${n=>n.disabled}"
        aria-readonly="${n=>n.readOnly}"
        @click="${(n,i)=>n.clickHandler(i.event)}"
        @keydown="${(n,i)=>n.keydownHandler(i.event)}"
        @focusout="${(n,i)=>n.focusOutHandler(i.event)}"
    >
        <slot name="label"></slot>
        <div
            class="positioning-region ${n=>n.orientation===Wa.horizontal?"horizontal":"vertical"}"
            part="positioning-region"
        >
            <slot
                ${Qe({property:"slottedRadioButtons",filter:Ua("[role=radio]")})}
            ></slot>
        </div>
    </template>
`;class Ut extends q{constructor(){super(...arguments),this.orientation=Wa.horizontal,this.radioChangeHandler=e=>{const n=e.target;n.checked&&(this.slottedRadioButtons.forEach(i=>{i!==n&&(i.checked=!1,this.isInsideFoundationToolbar||i.setAttribute("tabindex","-1"))}),this.selectedRadio=n,this.value=n.value,n.setAttribute("tabindex","0"),this.focusedRadio=n),e.stopPropagation()},this.moveToRadioByIndex=(e,n)=>{const i=e[n];this.isInsideToolbar||(i.setAttribute("tabindex","0"),i.readOnly?this.slottedRadioButtons.forEach(r=>{r!==i&&r.setAttribute("tabindex","-1")}):(i.checked=!0,this.selectedRadio=i)),this.focusedRadio=i,i.focus()},this.moveRightOffGroup=()=>{var e;(e=this.nextElementSibling)===null||e===void 0||e.focus()},this.moveLeftOffGroup=()=>{var e;(e=this.previousElementSibling)===null||e===void 0||e.focus()},this.focusOutHandler=e=>{const n=this.slottedRadioButtons,i=e.target,r=i!==null?n.indexOf(i):0,o=this.focusedRadio?n.indexOf(this.focusedRadio):-1;return(o===0&&r===o||o===n.length-1&&o===r)&&(this.selectedRadio?(this.focusedRadio=this.selectedRadio,this.isInsideFoundationToolbar||(this.selectedRadio.setAttribute("tabindex","0"),n.forEach(s=>{s!==this.selectedRadio&&s.setAttribute("tabindex","-1")}))):(this.focusedRadio=n[0],this.focusedRadio.setAttribute("tabindex","0"),n.forEach(s=>{s!==this.focusedRadio&&s.setAttribute("tabindex","-1")}))),!0},this.clickHandler=e=>{const n=e.target;if(n){const i=this.slottedRadioButtons;n.checked||i.indexOf(n)===0?(n.setAttribute("tabindex","0"),this.selectedRadio=n):(n.setAttribute("tabindex","-1"),this.selectedRadio=null),this.focusedRadio=n}e.preventDefault()},this.shouldMoveOffGroupToTheRight=(e,n,i)=>e===n.length&&this.isInsideToolbar&&i===gr,this.shouldMoveOffGroupToTheLeft=(e,n)=>(this.focusedRadio?e.indexOf(this.focusedRadio)-1:0)<0&&this.isInsideToolbar&&n===mr,this.checkFocusedRadio=()=>{this.focusedRadio!==null&&!this.focusedRadio.readOnly&&!this.focusedRadio.checked&&(this.focusedRadio.checked=!0,this.focusedRadio.setAttribute("tabindex","0"),this.focusedRadio.focus(),this.selectedRadio=this.focusedRadio)},this.moveRight=e=>{const n=this.slottedRadioButtons;let i=0;if(i=this.focusedRadio?n.indexOf(this.focusedRadio)+1:1,this.shouldMoveOffGroupToTheRight(i,n,e.key)){this.moveRightOffGroup();return}else i===n.length&&(i=0);for(;i<n.length&&n.length>1;)if(n[i].disabled){if(this.focusedRadio&&i===n.indexOf(this.focusedRadio))break;if(i+1>=n.length){if(this.isInsideToolbar)break;i=0}else i+=1}else{this.moveToRadioByIndex(n,i);break}},this.moveLeft=e=>{const n=this.slottedRadioButtons;let i=0;if(i=this.focusedRadio?n.indexOf(this.focusedRadio)-1:0,i=i<0?n.length-1:i,this.shouldMoveOffGroupToTheLeft(n,e.key)){this.moveLeftOffGroup();return}for(;i>=0&&n.length>1;)if(n[i].disabled){if(this.focusedRadio&&i===n.indexOf(this.focusedRadio))break;i-1<0?i=n.length-1:i-=1}else{this.moveToRadioByIndex(n,i);break}},this.keydownHandler=e=>{const n=e.key;if(n in iv&&this.isInsideFoundationToolbar)return!0;switch(n){case $r:{this.checkFocusedRadio();break}case gr:case mn:{this.direction===Zn.ltr?this.moveRight(e):this.moveLeft(e);break}case mr:case gn:{this.direction===Zn.ltr?this.moveLeft(e):this.moveRight(e);break}default:return!0}}}readOnlyChanged(){this.slottedRadioButtons!==void 0&&this.slottedRadioButtons.forEach(e=>{this.readOnly?e.readOnly=!0:e.readOnly=!1})}disabledChanged(){this.slottedRadioButtons!==void 0&&this.slottedRadioButtons.forEach(e=>{this.disabled?e.disabled=!0:e.disabled=!1})}nameChanged(){this.slottedRadioButtons&&this.slottedRadioButtons.forEach(e=>{e.setAttribute("name",this.name)})}valueChanged(){this.slottedRadioButtons&&this.slottedRadioButtons.forEach(e=>{e.value===this.value&&(e.checked=!0,this.selectedRadio=e)}),this.$emit("change")}slottedRadioButtonsChanged(e,n){this.slottedRadioButtons&&this.slottedRadioButtons.length>0&&this.setupRadioButtons()}get parentToolbar(){return this.closest('[role="toolbar"]')}get isInsideToolbar(){var e;return(e=this.parentToolbar)!==null&&e!==void 0?e:!1}get isInsideFoundationToolbar(){var e;return!!(!((e=this.parentToolbar)===null||e===void 0)&&e.$fastController)}connectedCallback(){super.connectedCallback(),this.direction=lv(this),this.setupRadioButtons()}disconnectedCallback(){this.slottedRadioButtons.forEach(e=>{e.removeEventListener("change",this.radioChangeHandler)})}setupRadioButtons(){const e=this.slottedRadioButtons.filter(r=>r.hasAttribute("checked")),n=e?e.length:0;if(n>1){const r=e[n-1];r.checked=!0}let i=!1;if(this.slottedRadioButtons.forEach(r=>{this.name!==void 0&&r.setAttribute("name",this.name),this.disabled&&(r.disabled=!0),this.readOnly&&(r.readOnly=!0),this.value&&this.value===r.value?(this.selectedRadio=r,this.focusedRadio=r,r.checked=!0,r.setAttribute("tabindex","0"),i=!0):(this.isInsideFoundationToolbar||r.setAttribute("tabindex","-1"),r.checked=!1),r.addEventListener("change",this.radioChangeHandler)}),this.value===void 0&&this.slottedRadioButtons.length>0){const r=this.slottedRadioButtons.filter(s=>s.hasAttribute("checked")),o=r!==null?r.length:0;if(o>0&&!i){const s=r[o-1];s.checked=!0,this.focusedRadio=s,s.setAttribute("tabindex","0")}else this.slottedRadioButtons[0].setAttribute("tabindex","0"),this.focusedRadio=this.slottedRadioButtons[0]}}}m([b({attribute:"readonly",mode:"boolean"})],Ut.prototype,"readOnly",void 0);m([b({attribute:"disabled",mode:"boolean"})],Ut.prototype,"disabled",void 0);m([b],Ut.prototype,"name",void 0);m([b],Ut.prototype,"value",void 0);m([b],Ut.prototype,"orientation",void 0);m([I],Ut.prototype,"childItems",void 0);m([I],Ut.prototype,"slottedRadioButtons",void 0);const jv=(t,e)=>V`
    <template
        role="radio"
        class="${n=>n.checked?"checked":""} ${n=>n.readOnly?"readonly":""}"
        aria-checked="${n=>n.checked}"
        aria-required="${n=>n.required}"
        aria-disabled="${n=>n.disabled}"
        aria-readonly="${n=>n.readOnly}"
        @keypress="${(n,i)=>n.keypressHandler(i.event)}"
        @click="${(n,i)=>n.clickHandler(i.event)}"
    >
        <div part="control" class="control">
            <slot name="checked-indicator">
                ${e.checkedIndicator||""}
            </slot>
        </div>
        <label
            part="label"
            class="${n=>n.defaultSlottedNodes&&n.defaultSlottedNodes.length?"label":"label label__hidden"}"
        >
            <slot ${Qe("defaultSlottedNodes")}></slot>
        </label>
    </template>
`;class Uv extends q{}class Wv extends xf(Uv){constructor(){super(...arguments),this.proxy=document.createElement("input")}}class os extends Wv{constructor(){super(),this.initialValue="on",this.keypressHandler=e=>{switch(e.key){case Sr:!this.checked&&!this.readOnly&&(this.checked=!0);return}return!0},this.proxy.setAttribute("type","radio")}readOnlyChanged(){this.proxy instanceof HTMLInputElement&&(this.proxy.readOnly=this.readOnly)}defaultCheckedChanged(){var e;this.$fastController.isConnected&&!this.dirtyChecked&&(this.isInsideRadioGroup()||(this.checked=(e=this.defaultChecked)!==null&&e!==void 0?e:!1,this.dirtyChecked=!1))}connectedCallback(){var e,n;super.connectedCallback(),this.validate(),((e=this.parentElement)===null||e===void 0?void 0:e.getAttribute("role"))!=="radiogroup"&&this.getAttribute("tabindex")===null&&(this.disabled||this.setAttribute("tabindex","0")),this.checkedAttribute&&(this.dirtyChecked||this.isInsideRadioGroup()||(this.checked=(n=this.defaultChecked)!==null&&n!==void 0?n:!1,this.dirtyChecked=!1))}isInsideRadioGroup(){return this.closest("[role=radiogroup]")!==null}clickHandler(e){!this.disabled&&!this.readOnly&&!this.checked&&(this.checked=!0)}}m([b({attribute:"readonly",mode:"boolean"})],os.prototype,"readOnly",void 0);m([I],os.prototype,"name",void 0);m([I],os.prototype,"defaultSlottedNodes",void 0);function Qv(t,e,n){return t.nodeType!==Node.TEXT_NODE?!0:typeof t.nodeValue=="string"&&!!t.nodeValue.trim().length}class qv extends rs{}class Gv extends Tr(qv){constructor(){super(...arguments),this.proxy=document.createElement("select")}}class Wt extends Gv{constructor(){super(...arguments),this.open=!1,this.forcedPosition=!1,this.listboxId=No("listbox-"),this.maxHeight=0}openChanged(e,n){if(!!this.collapsible){if(this.open){this.ariaControls=this.listboxId,this.ariaExpanded="true",this.setPositioning(),this.focusAndScrollOptionIntoView(),this.indexWhenOpened=this.selectedIndex,B.queueUpdate(()=>this.focus());return}this.ariaControls="",this.ariaExpanded="false"}}get collapsible(){return!(this.multiple||typeof this.size=="number")}get value(){return F.track(this,"value"),this._value}set value(e){var n,i,r,o,s,l,a;const u=`${this._value}`;if(!((n=this._options)===null||n===void 0)&&n.length){const h=this._options.findIndex(w=>w.value===e),g=(r=(i=this._options[this.selectedIndex])===null||i===void 0?void 0:i.value)!==null&&r!==void 0?r:null,p=(s=(o=this._options[h])===null||o===void 0?void 0:o.value)!==null&&s!==void 0?s:null;(h===-1||g!==p)&&(e="",this.selectedIndex=h),e=(a=(l=this.firstSelectedOption)===null||l===void 0?void 0:l.value)!==null&&a!==void 0?a:e}u!==e&&(this._value=e,super.valueChanged(u,e),F.notify(this,"value"),this.updateDisplayValue())}updateValue(e){var n,i;this.$fastController.isConnected&&(this.value=(i=(n=this.firstSelectedOption)===null||n===void 0?void 0:n.value)!==null&&i!==void 0?i:""),e&&(this.$emit("input"),this.$emit("change",this,{bubbles:!0,composed:void 0}))}selectedIndexChanged(e,n){super.selectedIndexChanged(e,n),this.updateValue()}positionChanged(e,n){this.positionAttribute=n,this.setPositioning()}setPositioning(){const e=this.getBoundingClientRect(),i=window.innerHeight-e.bottom;this.position=this.forcedPosition?this.positionAttribute:e.top>i?Us.above:Us.below,this.positionAttribute=this.forcedPosition?this.positionAttribute:this.position,this.maxHeight=this.position===Us.above?~~e.top:~~i}get displayValue(){var e,n;return F.track(this,"displayValue"),(n=(e=this.firstSelectedOption)===null||e===void 0?void 0:e.text)!==null&&n!==void 0?n:""}disabledChanged(e,n){super.disabledChanged&&super.disabledChanged(e,n),this.ariaDisabled=this.disabled?"true":"false"}formResetCallback(){this.setProxyOptions(),super.setDefaultSelectedOption(),this.selectedIndex===-1&&(this.selectedIndex=0)}clickHandler(e){if(!this.disabled){if(this.open){const n=e.target.closest("option,[role=option]");if(n&&n.disabled)return}return super.clickHandler(e),this.open=this.collapsible&&!this.open,!this.open&&this.indexWhenOpened!==this.selectedIndex&&this.updateValue(!0),!0}}focusoutHandler(e){var n;if(super.focusoutHandler(e),!this.open)return!0;const i=e.relatedTarget;if(this.isSameNode(i)){this.focus();return}!((n=this.options)===null||n===void 0)&&n.includes(i)||(this.open=!1,this.indexWhenOpened!==this.selectedIndex&&this.updateValue(!0))}handleChange(e,n){super.handleChange(e,n),n==="value"&&this.updateValue()}slottedOptionsChanged(e,n){this.options.forEach(i=>{F.getNotifier(i).unsubscribe(this,"value")}),super.slottedOptionsChanged(e,n),this.options.forEach(i=>{F.getNotifier(i).subscribe(this,"value")}),this.setProxyOptions(),this.updateValue()}mousedownHandler(e){var n;return e.offsetX>=0&&e.offsetX<=((n=this.listbox)===null||n===void 0?void 0:n.scrollWidth)?super.mousedownHandler(e):this.collapsible}multipleChanged(e,n){super.multipleChanged(e,n),this.proxy&&(this.proxy.multiple=n)}selectedOptionsChanged(e,n){var i;super.selectedOptionsChanged(e,n),(i=this.options)===null||i===void 0||i.forEach((r,o)=>{var s;const l=(s=this.proxy)===null||s===void 0?void 0:s.options.item(o);l&&(l.selected=r.selected)})}setDefaultSelectedOption(){var e;const n=(e=this.options)!==null&&e!==void 0?e:Array.from(this.children).filter($e.slottedOptionFilter),i=n==null?void 0:n.findIndex(r=>r.hasAttribute("selected")||r.selected||r.value===this.value);if(i!==-1){this.selectedIndex=i;return}this.selectedIndex=0}setProxyOptions(){this.proxy instanceof HTMLSelectElement&&this.options&&(this.proxy.options.length=0,this.options.forEach(e=>{const n=e.proxy||(e instanceof HTMLOptionElement?e.cloneNode():null);n&&this.proxy.options.add(n)}))}keydownHandler(e){super.keydownHandler(e);const n=e.key||e.key.charCodeAt(0);switch(n){case Sr:{e.preventDefault(),this.collapsible&&this.typeAheadExpired&&(this.open=!this.open);break}case ai:case ui:{e.preventDefault();break}case $r:{e.preventDefault(),this.open=!this.open;break}case ts:{this.collapsible&&this.open&&(e.preventDefault(),this.open=!1);break}case Qa:return this.collapsible&&this.open&&(e.preventDefault(),this.open=!1),!0}return!this.open&&this.indexWhenOpened!==this.selectedIndex&&(this.updateValue(!0),this.indexWhenOpened=this.selectedIndex),!(n===mn||n===gn)}connectedCallback(){super.connectedCallback(),this.forcedPosition=!!this.positionAttribute,this.addEventListener("contentchange",this.updateDisplayValue)}disconnectedCallback(){this.removeEventListener("contentchange",this.updateDisplayValue),super.disconnectedCallback()}sizeChanged(e,n){super.sizeChanged(e,n),this.proxy&&(this.proxy.size=n)}updateDisplayValue(){this.collapsible&&F.notify(this,"displayValue")}}m([b({attribute:"open",mode:"boolean"})],Wt.prototype,"open",void 0);m([Zm],Wt.prototype,"collapsible",null);m([I],Wt.prototype,"control",void 0);m([b({attribute:"position"})],Wt.prototype,"positionAttribute",void 0);m([I],Wt.prototype,"position",void 0);m([I],Wt.prototype,"maxHeight",void 0);class Za{}m([I],Za.prototype,"ariaControls",void 0);Le(Za,vn);Le(Wt,oi,Za);const Yv=(t,e)=>V`
    <template
        class="${n=>[n.collapsible&&"collapsible",n.collapsible&&n.open&&"open",n.disabled&&"disabled",n.collapsible&&n.position].filter(Boolean).join(" ")}"
        aria-activedescendant="${n=>n.ariaActiveDescendant}"
        aria-controls="${n=>n.ariaControls}"
        aria-disabled="${n=>n.ariaDisabled}"
        aria-expanded="${n=>n.ariaExpanded}"
        aria-haspopup="${n=>n.collapsible?"listbox":null}"
        aria-multiselectable="${n=>n.ariaMultiSelectable}"
        ?open="${n=>n.open}"
        role="combobox"
        tabindex="${n=>n.disabled?null:"0"}"
        @click="${(n,i)=>n.clickHandler(i.event)}"
        @focusin="${(n,i)=>n.focusinHandler(i.event)}"
        @focusout="${(n,i)=>n.focusoutHandler(i.event)}"
        @keydown="${(n,i)=>n.keydownHandler(i.event)}"
        @mousedown="${(n,i)=>n.mousedownHandler(i.event)}"
    >
        ${ja(n=>n.collapsible,V`
                <div
                    class="control"
                    part="control"
                    ?disabled="${n=>n.disabled}"
                    ${Se("control")}
                >
                    ${li(t,e)}
                    <slot name="button-container">
                        <div class="selected-value" part="selected-value">
                            <slot name="selected-value">${n=>n.displayValue}</slot>
                        </div>
                        <div aria-hidden="true" class="indicator" part="indicator">
                            <slot name="indicator">
                                ${e.indicator||""}
                            </slot>
                        </div>
                    </slot>
                    ${si(t,e)}
                </div>
            `)}
        <div
            class="listbox"
            id="${n=>n.listboxId}"
            part="listbox"
            role="listbox"
            ?disabled="${n=>n.disabled}"
            ?hidden="${n=>n.collapsible?!n.open:!1}"
            ${Se("listbox")}
        >
            <slot
                ${Qe({filter:$e.slottedOptionFilter,flatten:!0,property:"slottedOptions"})}
            ></slot>
        </div>
    </template>
`,Xv=(t,e)=>V`
    <template slot="tabpanel" role="tabpanel">
        <slot></slot>
    </template>
`;class Zv extends q{}const Jv=(t,e)=>V`
    <template slot="tab" role="tab" aria-disabled="${n=>n.disabled}">
        <slot></slot>
    </template>
`;class Tf extends q{}m([b({mode:"boolean"})],Tf.prototype,"disabled",void 0);const Kv=(t,e)=>V`
    <template class="${n=>n.orientation}">
        ${li(t,e)}
        <div class="tablist" part="tablist" role="tablist">
            <slot class="tab" name="tab" part="tab" ${Qe("tabs")}></slot>

            ${ja(n=>n.showActiveIndicator,V`
                    <div
                        ${Se("activeIndicatorRef")}
                        class="activeIndicator"
                        part="activeIndicator"
                    ></div>
                `)}
        </div>
        ${si(t,e)}
        <div class="tabpanel" part="tabpanel">
            <slot name="tabpanel" ${Qe("tabpanels")}></slot>
        </div>
    </template>
`,Ml={vertical:"vertical",horizontal:"horizontal"};class yt extends q{constructor(){super(...arguments),this.orientation=Ml.horizontal,this.activeindicator=!0,this.showActiveIndicator=!0,this.prevActiveTabIndex=0,this.activeTabIndex=0,this.ticking=!1,this.change=()=>{this.$emit("change",this.activetab)},this.isDisabledElement=e=>e.getAttribute("aria-disabled")==="true",this.isHiddenElement=e=>e.hasAttribute("hidden"),this.isFocusableElement=e=>!this.isDisabledElement(e)&&!this.isHiddenElement(e),this.setTabs=()=>{const e="gridColumn",n="gridRow",i=this.isHorizontal()?e:n;this.activeTabIndex=this.getActiveIndex(),this.showActiveIndicator=!1,this.tabs.forEach((r,o)=>{if(r.slot==="tab"){const s=this.activeTabIndex===o&&this.isFocusableElement(r);this.activeindicator&&this.isFocusableElement(r)&&(this.showActiveIndicator=!0);const l=this.tabIds[o],a=this.tabpanelIds[o];r.setAttribute("id",l),r.setAttribute("aria-selected",s?"true":"false"),r.setAttribute("aria-controls",a),r.addEventListener("click",this.handleTabClick),r.addEventListener("keydown",this.handleTabKeyDown),r.setAttribute("tabindex",s?"0":"-1"),s&&(this.activetab=r,this.activeid=l)}r.style[e]="",r.style[n]="",r.style[i]=`${o+1}`,this.isHorizontal()?r.classList.remove("vertical"):r.classList.add("vertical")})},this.setTabPanels=()=>{this.tabpanels.forEach((e,n)=>{const i=this.tabIds[n],r=this.tabpanelIds[n];e.setAttribute("id",r),e.setAttribute("aria-labelledby",i),this.activeTabIndex!==n?e.setAttribute("hidden",""):e.removeAttribute("hidden")})},this.handleTabClick=e=>{const n=e.currentTarget;n.nodeType===1&&this.isFocusableElement(n)&&(this.prevActiveTabIndex=this.activeTabIndex,this.activeTabIndex=this.tabs.indexOf(n),this.setComponent())},this.handleTabKeyDown=e=>{if(this.isHorizontal())switch(e.key){case mr:e.preventDefault(),this.adjustBackward(e);break;case gr:e.preventDefault(),this.adjustForward(e);break}else switch(e.key){case gn:e.preventDefault(),this.adjustBackward(e);break;case mn:e.preventDefault(),this.adjustForward(e);break}switch(e.key){case ai:e.preventDefault(),this.adjust(-this.activeTabIndex);break;case ui:e.preventDefault(),this.adjust(this.tabs.length-this.activeTabIndex-1);break}},this.adjustForward=e=>{const n=this.tabs;let i=0;for(i=this.activetab?n.indexOf(this.activetab)+1:1,i===n.length&&(i=0);i<n.length&&n.length>1;)if(this.isFocusableElement(n[i])){this.moveToTabByIndex(n,i);break}else{if(this.activetab&&i===n.indexOf(this.activetab))break;i+1>=n.length?i=0:i+=1}},this.adjustBackward=e=>{const n=this.tabs;let i=0;for(i=this.activetab?n.indexOf(this.activetab)-1:0,i=i<0?n.length-1:i;i>=0&&n.length>1;)if(this.isFocusableElement(n[i])){this.moveToTabByIndex(n,i);break}else i-1<0?i=n.length-1:i-=1},this.moveToTabByIndex=(e,n)=>{const i=e[n];this.activetab=i,this.prevActiveTabIndex=this.activeTabIndex,this.activeTabIndex=n,i.focus(),this.setComponent()}}orientationChanged(){this.$fastController.isConnected&&(this.setTabs(),this.setTabPanels(),this.handleActiveIndicatorPosition())}activeidChanged(e,n){this.$fastController.isConnected&&this.tabs.length<=this.tabpanels.length&&(this.prevActiveTabIndex=this.tabs.findIndex(i=>i.id===e),this.setTabs(),this.setTabPanels(),this.handleActiveIndicatorPosition())}tabsChanged(){this.$fastController.isConnected&&this.tabs.length<=this.tabpanels.length&&(this.tabIds=this.getTabIds(),this.tabpanelIds=this.getTabPanelIds(),this.setTabs(),this.setTabPanels(),this.handleActiveIndicatorPosition())}tabpanelsChanged(){this.$fastController.isConnected&&this.tabpanels.length<=this.tabs.length&&(this.tabIds=this.getTabIds(),this.tabpanelIds=this.getTabPanelIds(),this.setTabs(),this.setTabPanels(),this.handleActiveIndicatorPosition())}getActiveIndex(){return this.activeid!==void 0?this.tabIds.indexOf(this.activeid)===-1?0:this.tabIds.indexOf(this.activeid):0}getTabIds(){return this.tabs.map(e=>{var n;return(n=e.getAttribute("id"))!==null&&n!==void 0?n:`tab-${No()}`})}getTabPanelIds(){return this.tabpanels.map(e=>{var n;return(n=e.getAttribute("id"))!==null&&n!==void 0?n:`panel-${No()}`})}setComponent(){this.activeTabIndex!==this.prevActiveTabIndex&&(this.activeid=this.tabIds[this.activeTabIndex],this.focusTab(),this.change())}isHorizontal(){return this.orientation===Ml.horizontal}handleActiveIndicatorPosition(){this.showActiveIndicator&&this.activeindicator&&this.activeTabIndex!==this.prevActiveTabIndex&&(this.ticking?this.ticking=!1:(this.ticking=!0,this.animateActiveIndicator()))}animateActiveIndicator(){this.ticking=!0;const e=this.isHorizontal()?"gridColumn":"gridRow",n=this.isHorizontal()?"translateX":"translateY",i=this.isHorizontal()?"offsetLeft":"offsetTop",r=this.activeIndicatorRef[i];this.activeIndicatorRef.style[e]=`${this.activeTabIndex+1}`;const o=this.activeIndicatorRef[i];this.activeIndicatorRef.style[e]=`${this.prevActiveTabIndex+1}`;const s=o-r;this.activeIndicatorRef.style.transform=`${n}(${s}px)`,this.activeIndicatorRef.classList.add("activeIndicatorTransition"),this.activeIndicatorRef.addEventListener("transitionend",()=>{this.ticking=!1,this.activeIndicatorRef.style[e]=`${this.activeTabIndex+1}`,this.activeIndicatorRef.style.transform=`${n}(0px)`,this.activeIndicatorRef.classList.remove("activeIndicatorTransition")})}adjust(e){const n=this.tabs.filter(s=>this.isFocusableElement(s)),i=n.indexOf(this.activetab),r=rv(0,n.length-1,i+e),o=this.tabs.indexOf(n[r]);o>-1&&this.moveToTabByIndex(this.tabs,o)}focusTab(){this.tabs[this.activeTabIndex].focus()}connectedCallback(){super.connectedCallback(),this.tabIds=this.getTabIds(),this.tabpanelIds=this.getTabPanelIds(),this.activeTabIndex=this.getActiveIndex()}}m([b],yt.prototype,"orientation",void 0);m([b],yt.prototype,"activeid",void 0);m([I],yt.prototype,"tabs",void 0);m([I],yt.prototype,"tabpanels",void 0);m([b({mode:"boolean"})],yt.prototype,"activeindicator",void 0);m([I],yt.prototype,"activeIndicatorRef",void 0);m([I],yt.prototype,"showActiveIndicator",void 0);Le(yt,oi);class ey extends q{}class ty extends Tr(ey){constructor(){super(...arguments),this.proxy=document.createElement("textarea")}}const If={none:"none",both:"both",horizontal:"horizontal",vertical:"vertical"};class Ie extends ty{constructor(){super(...arguments),this.resize=If.none,this.cols=20,this.handleTextInput=()=>{this.value=this.control.value}}readOnlyChanged(){this.proxy instanceof HTMLTextAreaElement&&(this.proxy.readOnly=this.readOnly)}autofocusChanged(){this.proxy instanceof HTMLTextAreaElement&&(this.proxy.autofocus=this.autofocus)}listChanged(){this.proxy instanceof HTMLTextAreaElement&&this.proxy.setAttribute("list",this.list)}maxlengthChanged(){this.proxy instanceof HTMLTextAreaElement&&(this.proxy.maxLength=this.maxlength)}minlengthChanged(){this.proxy instanceof HTMLTextAreaElement&&(this.proxy.minLength=this.minlength)}spellcheckChanged(){this.proxy instanceof HTMLTextAreaElement&&(this.proxy.spellcheck=this.spellcheck)}select(){this.control.select(),this.$emit("select")}handleChange(){this.$emit("change")}validate(){super.validate(this.control)}}m([b({mode:"boolean"})],Ie.prototype,"readOnly",void 0);m([b],Ie.prototype,"resize",void 0);m([b({mode:"boolean"})],Ie.prototype,"autofocus",void 0);m([b({attribute:"form"})],Ie.prototype,"formId",void 0);m([b],Ie.prototype,"list",void 0);m([b({converter:Ke})],Ie.prototype,"maxlength",void 0);m([b({converter:Ke})],Ie.prototype,"minlength",void 0);m([b],Ie.prototype,"name",void 0);m([b],Ie.prototype,"placeholder",void 0);m([b({converter:Ke,mode:"fromView"})],Ie.prototype,"cols",void 0);m([b({converter:Ke,mode:"fromView"})],Ie.prototype,"rows",void 0);m([b({mode:"boolean"})],Ie.prototype,"spellcheck",void 0);m([I],Ie.prototype,"defaultSlottedNodes",void 0);Le(Ie,Xa);const ny=(t,e)=>V`
    <template
        class="
            ${n=>n.readOnly?"readonly":""}
            ${n=>n.resize!==If.none?`resize-${n.resize}`:""}"
    >
        <label
            part="label"
            for="control"
            class="${n=>n.defaultSlottedNodes&&n.defaultSlottedNodes.length?"label":"label label__hidden"}"
        >
            <slot ${Qe("defaultSlottedNodes")}></slot>
        </label>
        <textarea
            part="control"
            class="control"
            id="control"
            ?autofocus="${n=>n.autofocus}"
            cols="${n=>n.cols}"
            ?disabled="${n=>n.disabled}"
            form="${n=>n.form}"
            list="${n=>n.list}"
            maxlength="${n=>n.maxlength}"
            minlength="${n=>n.minlength}"
            name="${n=>n.name}"
            placeholder="${n=>n.placeholder}"
            ?readonly="${n=>n.readOnly}"
            ?required="${n=>n.required}"
            rows="${n=>n.rows}"
            ?spellcheck="${n=>n.spellcheck}"
            :value="${n=>n.value}"
            aria-atomic="${n=>n.ariaAtomic}"
            aria-busy="${n=>n.ariaBusy}"
            aria-controls="${n=>n.ariaControls}"
            aria-current="${n=>n.ariaCurrent}"
            aria-describedby="${n=>n.ariaDescribedby}"
            aria-details="${n=>n.ariaDetails}"
            aria-disabled="${n=>n.ariaDisabled}"
            aria-errormessage="${n=>n.ariaErrormessage}"
            aria-flowto="${n=>n.ariaFlowto}"
            aria-haspopup="${n=>n.ariaHaspopup}"
            aria-hidden="${n=>n.ariaHidden}"
            aria-invalid="${n=>n.ariaInvalid}"
            aria-keyshortcuts="${n=>n.ariaKeyshortcuts}"
            aria-label="${n=>n.ariaLabel}"
            aria-labelledby="${n=>n.ariaLabelledby}"
            aria-live="${n=>n.ariaLive}"
            aria-owns="${n=>n.ariaOwns}"
            aria-relevant="${n=>n.ariaRelevant}"
            aria-roledescription="${n=>n.ariaRoledescription}"
            @input="${(n,i)=>n.handleTextInput()}"
            @change="${n=>n.handleChange()}"
            ${Se("control")}
        ></textarea>
    </template>
`,iy=(t,e)=>V`
    <template
        class="
            ${n=>n.readOnly?"readonly":""}
        "
    >
        <label
            part="label"
            for="control"
            class="${n=>n.defaultSlottedNodes&&n.defaultSlottedNodes.length?"label":"label label__hidden"}"
        >
            <slot
                ${Qe({property:"defaultSlottedNodes",filter:Qv})}
            ></slot>
        </label>
        <div class="root" part="root">
            ${li(t,e)}
            <input
                class="control"
                part="control"
                id="control"
                @input="${n=>n.handleTextInput()}"
                @change="${n=>n.handleChange()}"
                ?autofocus="${n=>n.autofocus}"
                ?disabled="${n=>n.disabled}"
                list="${n=>n.list}"
                maxlength="${n=>n.maxlength}"
                minlength="${n=>n.minlength}"
                pattern="${n=>n.pattern}"
                placeholder="${n=>n.placeholder}"
                ?readonly="${n=>n.readOnly}"
                ?required="${n=>n.required}"
                size="${n=>n.size}"
                ?spellcheck="${n=>n.spellcheck}"
                :value="${n=>n.value}"
                type="${n=>n.type}"
                aria-atomic="${n=>n.ariaAtomic}"
                aria-busy="${n=>n.ariaBusy}"
                aria-controls="${n=>n.ariaControls}"
                aria-current="${n=>n.ariaCurrent}"
                aria-describedby="${n=>n.ariaDescribedby}"
                aria-details="${n=>n.ariaDetails}"
                aria-disabled="${n=>n.ariaDisabled}"
                aria-errormessage="${n=>n.ariaErrormessage}"
                aria-flowto="${n=>n.ariaFlowto}"
                aria-haspopup="${n=>n.ariaHaspopup}"
                aria-hidden="${n=>n.ariaHidden}"
                aria-invalid="${n=>n.ariaInvalid}"
                aria-keyshortcuts="${n=>n.ariaKeyshortcuts}"
                aria-label="${n=>n.ariaLabel}"
                aria-labelledby="${n=>n.ariaLabelledby}"
                aria-live="${n=>n.ariaLive}"
                aria-owns="${n=>n.ariaOwns}"
                aria-relevant="${n=>n.ariaRelevant}"
                aria-roledescription="${n=>n.ariaRoledescription}"
                ${Se("control")}
            />
            ${si(t,e)}
        </div>
    </template>
`,zt="not-allowed",ry=":host([hidden]){display:none}";function xe(t){return`${ry}:host{display:${t}}`}const be=Kg()?"focus-visible":"focus",oy=new Set(["children","localName","ref","style","className"]),sy=Object.freeze(Object.create(null)),Qc="_default",qr=new Map;function ly(t,e){typeof t=="function"?t(e):t.current=e}function Of(t,e){if(!e.name){const n=Cr.forType(t);if(n)e.name=n.name;else throw new Error("React wrappers must wrap a FASTElement or be configured with a name.")}return e.name}function zl(t){return t.events||(t.events={})}function qc(t,e,n){return oy.has(n)?(console.warn(`${Of(t,e)} contains property ${n} which is a React reserved property. It will be used by React and not set on the element.`),!1):!0}function ay(t,e){if(!e.keys)if(e.properties)e.keys=new Set(e.properties.concat(Object.keys(zl(e))));else{const n=new Set(Object.keys(zl(e))),i=F.getAccessors(t.prototype);if(i.length>0)for(const r of i)qc(t,e,r.name)&&n.add(r.name);else for(const r in t.prototype)!(r in HTMLElement.prototype)&&qc(t,e,r)&&n.add(r);e.keys=n}return e.keys}function uy(t,e){let n=[];const i={register(o,...s){n.forEach(l=>l.register(o,...s)),n=[]}};function r(o,s={}){var l,a;o instanceof bf&&(e?e.register(o):n.push(o),o=o.type);const u=qr.get(o);if(u){const p=u.get((l=s.name)!==null&&l!==void 0?l:Qc);if(p)return p}class h extends t.Component{constructor(){super(...arguments),this._element=null}_updateElement(w){const k=this._element;if(k===null)return;const $=this.props,f=w||sy,c=zl(s);for(const d in this._elementProps){const v=$[d],y=c[d];if(y===void 0)k[d]=v;else{const O=f[d];if(v===O)continue;O!==void 0&&k.removeEventListener(y,O),v!==void 0&&k.addEventListener(y,v)}}}componentDidMount(){this._updateElement()}componentDidUpdate(w){this._updateElement(w)}render(){const w=this.props.__forwardedRef;(this._ref===void 0||this._userRef!==w)&&(this._ref=d=>{this._element===null&&(this._element=d),w!==null&&ly(w,d),this._userRef=w});const k={ref:this._ref},$=this._elementProps={},f=ay(o,s),c=this.props;for(const d in c){const v=c[d];f.has(d)?$[d]=v:k[d==="className"?"class":d]=v}return t.createElement(Of(o,s),k)}}const g=t.forwardRef((p,w)=>t.createElement(h,Object.assign(Object.assign({},p),{__forwardedRef:w}),p==null?void 0:p.children));return qr.has(o)||qr.set(o,new Map),qr.get(o).set((a=s.name)!==null&&a!==void 0?a:Qc,g),g}return{wrap:r,registry:i}}function cy(t){return Sf.getOrCreate(t).withPrefix("vscode")}function dy(t){window.addEventListener("load",()=>{new MutationObserver(()=>{Gc(t)}).observe(document.body,{attributes:!0,attributeFilter:["class"]}),Gc(t)})}function Gc(t){const e=getComputedStyle(document.body),n=document.querySelector("body");if(n){const i=n.getAttribute("data-vscode-theme-kind");for(const[r,o]of t){let s=e.getPropertyValue(r).toString();if(i==="vscode-high-contrast")s.length===0&&o.name.includes("background")&&(s="transparent"),o.name==="button-icon-hover-background"&&(s="transparent");else if(i==="vscode-high-contrast-light"){if(s.length===0&&o.name.includes("background"))switch(o.name){case"button-primary-hover-background":s="#0F4A85";break;case"button-secondary-hover-background":s="transparent";break;case"button-icon-hover-background":s="transparent";break}}else o.name==="contrast-active-border"&&(s="transparent");o.setValueFor(n,s)}}}const Yc=new Map;let Xc=!1;function E(t,e){const n=$f.create(t);if(e){if(e.includes("--fake-vscode-token")){const i="id"+Math.random().toString(16).slice(2);e=`${e}-${i}`}Yc.set(e,n)}return Xc||(dy(Yc),Xc=!0),n}const hy=E("background","--vscode-editor-background").withDefault("#1e1e1e"),M=E("border-width").withDefault(1),Rf=E("contrast-active-border","--vscode-contrastActiveBorder").withDefault("#f38518");E("contrast-border","--vscode-contrastBorder").withDefault("#6fc3df");const cn=E("corner-radius").withDefault(0),Ja=E("corner-radius-round").withDefault(2),D=E("design-unit").withDefault(4),yn=E("disabled-opacity").withDefault(.4),W=E("focus-border","--vscode-focusBorder").withDefault("#007fd4"),Ge=E("font-family","--vscode-font-family").withDefault("-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol");E("font-weight","--vscode-font-weight").withDefault("400");const ve=E("foreground","--vscode-foreground").withDefault("#cccccc"),ao=E("input-height").withDefault("26"),Ka=E("input-min-width").withDefault("100px"),Ee=E("type-ramp-base-font-size","--vscode-font-size").withDefault("13px"),_e=E("type-ramp-base-line-height").withDefault("normal"),Pf=E("type-ramp-minus1-font-size").withDefault("11px"),Df=E("type-ramp-minus1-line-height").withDefault("16px");E("type-ramp-minus2-font-size").withDefault("9px");E("type-ramp-minus2-line-height").withDefault("16px");E("type-ramp-plus1-font-size").withDefault("16px");E("type-ramp-plus1-line-height").withDefault("24px");const fy=E("scrollbarWidth").withDefault("10px"),py=E("scrollbarHeight").withDefault("10px"),my=E("scrollbar-slider-background","--vscode-scrollbarSlider-background").withDefault("#79797966"),gy=E("scrollbar-slider-hover-background","--vscode-scrollbarSlider-hoverBackground").withDefault("#646464b3"),vy=E("scrollbar-slider-active-background","--vscode-scrollbarSlider-activeBackground").withDefault("#bfbfbf66"),Af=E("badge-background","--vscode-badge-background").withDefault("#4d4d4d"),_f=E("badge-foreground","--vscode-badge-foreground").withDefault("#ffffff"),eu=E("button-border","--vscode-button-border").withDefault("transparent"),Zc=E("button-icon-background").withDefault("transparent"),yy=E("button-icon-corner-radius").withDefault("5px"),by=E("button-icon-outline-offset").withDefault(0),Jc=E("button-icon-hover-background","--fake-vscode-token").withDefault("rgba(90, 93, 94, 0.31)"),wy=E("button-icon-padding").withDefault("3px"),jn=E("button-primary-background","--vscode-button-background").withDefault("#0e639c"),Lf=E("button-primary-foreground","--vscode-button-foreground").withDefault("#ffffff"),Nf=E("button-primary-hover-background","--vscode-button-hoverBackground").withDefault("#1177bb"),Gs=E("button-secondary-background","--vscode-button-secondaryBackground").withDefault("#3a3d41"),xy=E("button-secondary-foreground","--vscode-button-secondaryForeground").withDefault("#ffffff"),ky=E("button-secondary-hover-background","--vscode-button-secondaryHoverBackground").withDefault("#45494e"),Cy=E("button-padding-horizontal").withDefault("11px"),$y=E("button-padding-vertical").withDefault("4px"),ut=E("checkbox-background","--vscode-checkbox-background").withDefault("#3c3c3c"),Pn=E("checkbox-border","--vscode-checkbox-border").withDefault("#3c3c3c"),Sy=E("checkbox-corner-radius").withDefault(3);E("checkbox-foreground","--vscode-checkbox-foreground").withDefault("#f0f0f0");const Zt=E("list-active-selection-background","--vscode-list-activeSelectionBackground").withDefault("#094771"),Un=E("list-active-selection-foreground","--vscode-list-activeSelectionForeground").withDefault("#ffffff"),Ey=E("list-hover-background","--vscode-list-hoverBackground").withDefault("#2a2d2e"),Ty=E("divider-background","--vscode-settings-dropdownListBorder").withDefault("#454545"),Gr=E("dropdown-background","--vscode-dropdown-background").withDefault("#3c3c3c"),At=E("dropdown-border","--vscode-dropdown-border").withDefault("#3c3c3c");E("dropdown-foreground","--vscode-dropdown-foreground").withDefault("#f0f0f0");const Iy=E("dropdown-list-max-height").withDefault("200px"),rn=E("input-background","--vscode-input-background").withDefault("#3c3c3c"),Ff=E("input-foreground","--vscode-input-foreground").withDefault("#cccccc");E("input-placeholder-foreground","--vscode-input-placeholderForeground").withDefault("#cccccc");const Kc=E("link-active-foreground","--vscode-textLink-activeForeground").withDefault("#3794ff"),Oy=E("link-foreground","--vscode-textLink-foreground").withDefault("#3794ff"),Ry=E("progress-background","--vscode-progressBar-background").withDefault("#0e70c0"),Py=E("panel-tab-active-border","--vscode-panelTitle-activeBorder").withDefault("#e7e7e7"),Cn=E("panel-tab-active-foreground","--vscode-panelTitle-activeForeground").withDefault("#e7e7e7"),Dy=E("panel-tab-foreground","--vscode-panelTitle-inactiveForeground").withDefault("#e7e7e799");E("panel-view-background","--vscode-panel-background").withDefault("#1e1e1e");E("panel-view-border","--vscode-panel-border").withDefault("#80808059");const Ay=E("tag-corner-radius").withDefault("2px"),_y=(t,e)=>X`
	${xe("inline-block")} :host {
		box-sizing: border-box;
		font-family: ${Ge};
		font-size: ${Pf};
		line-height: ${Df};
		text-align: center;
	}
	.control {
		align-items: center;
		background-color: ${Af};
		border: calc(${M} * 1px) solid ${eu};
		border-radius: 11px;
		box-sizing: border-box;
		color: ${_f};
		display: flex;
		height: calc(${D} * 4px);
		justify-content: center;
		min-width: calc(${D} * 4px + 2px);
		min-height: calc(${D} * 4px + 2px);
		padding: 3px 6px;
	}
`;class Ly extends Er{connectedCallback(){super.connectedCallback(),this.circular||(this.circular=!0)}}const Ny=Ly.compose({baseName:"badge",template:wf,styles:_y}),Fy=X`
	${xe("inline-flex")} :host {
		outline: none;
		font-family: ${Ge};
		font-size: ${Ee};
		line-height: ${_e};
		color: ${Lf};
		background: ${jn};
		border-radius: calc(${Ja} * 1px);
		fill: currentColor;
		cursor: pointer;
	}
	.control {
		background: transparent;
		height: inherit;
		flex-grow: 1;
		box-sizing: border-box;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		padding: ${$y} ${Cy};
		white-space: wrap;
		outline: none;
		text-decoration: none;
		border: calc(${M} * 1px) solid ${eu};
		color: inherit;
		border-radius: inherit;
		fill: inherit;
		cursor: inherit;
		font-family: inherit;
	}
	:host(:hover) {
		background: ${Nf};
	}
	:host(:active) {
		background: ${jn};
	}
	.control:${be} {
		outline: calc(${M} * 1px) solid ${W};
		outline-offset: calc(${M} * 2px);
	}
	.control::-moz-focus-inner {
		border: 0;
	}
	:host([disabled]) {
		opacity: ${yn};
		background: ${jn};
		cursor: ${zt};
	}
	.content {
		display: flex;
	}
	.start {
		display: flex;
	}
	::slotted(svg),
	::slotted(span) {
		width: calc(${D} * 4px);
		height: calc(${D} * 4px);
	}
	.start {
		margin-inline-end: 8px;
	}
`,By=X`
	:host([appearance='primary']) {
		background: ${jn};
		color: ${Lf};
	}
	:host([appearance='primary']:hover) {
		background: ${Nf};
	}
	:host([appearance='primary']:active) .control:active {
		background: ${jn};
	}
	:host([appearance='primary']) .control:${be} {
		outline: calc(${M} * 1px) solid ${W};
		outline-offset: calc(${M} * 2px);
	}
	:host([appearance='primary'][disabled]) {
		background: ${jn};
	}
`,My=X`
	:host([appearance='secondary']) {
		background: ${Gs};
		color: ${xy};
	}
	:host([appearance='secondary']:hover) {
		background: ${ky};
	}
	:host([appearance='secondary']:active) .control:active {
		background: ${Gs};
	}
	:host([appearance='secondary']) .control:${be} {
		outline: calc(${M} * 1px) solid ${W};
		outline-offset: calc(${M} * 2px);
	}
	:host([appearance='secondary'][disabled]) {
		background: ${Gs};
	}
`,zy=X`
	:host([appearance='icon']) {
		background: ${Zc};
		border-radius: ${yy};
		color: ${ve};
	}
	:host([appearance='icon']:hover) {
		background: ${Jc};
		outline: 1px dotted ${Rf};
		outline-offset: -1px;
	}
	:host([appearance='icon']) .control {
		padding: ${wy};
		border: none;
	}
	:host([appearance='icon']:active) .control:active {
		background: ${Jc};
	}
	:host([appearance='icon']) .control:${be} {
		outline: calc(${M} * 1px) solid ${W};
		outline-offset: ${by};
	}
	:host([appearance='icon'][disabled]) {
		background: ${Zc};
	}
`,Vy=(t,e)=>X`
	${Fy}
	${By}
	${My}
	${zy}
`;class Bf extends tt{connectedCallback(){if(super.connectedCallback(),!this.appearance){const e=this.getAttribute("appearance");this.appearance=e}}attributeChangedCallback(e,n,i){e==="appearance"&&i==="icon"&&(this.getAttribute("aria-label")||(this.ariaLabel="Icon Button")),e==="aria-label"&&(this.ariaLabel=i),e==="disabled"&&(this.disabled=i!==null)}}m([b],Bf.prototype,"appearance",void 0);const Hy=Bf.compose({baseName:"button",template:av,styles:Vy,shadowOptions:{delegatesFocus:!0}}),jy=(t,e)=>X`
	${xe("inline-flex")} :host {
		align-items: center;
		outline: none;
		margin: calc(${D} * 1px) 0;
		user-select: none;
		font-size: ${Ee};
		line-height: ${_e};
	}
	.control {
		position: relative;
		width: calc(${D} * 4px + 2px);
		height: calc(${D} * 4px + 2px);
		box-sizing: border-box;
		border-radius: calc(${Sy} * 1px);
		border: calc(${M} * 1px) solid ${Pn};
		background: ${ut};
		outline: none;
		cursor: pointer;
	}
	.label {
		font-family: ${Ge};
		color: ${ve};
		padding-inline-start: calc(${D} * 2px + 2px);
		margin-inline-end: calc(${D} * 2px + 2px);
		cursor: pointer;
	}
	.label__hidden {
		display: none;
		visibility: hidden;
	}
	.checked-indicator {
		width: 100%;
		height: 100%;
		display: block;
		fill: ${ve};
		opacity: 0;
		pointer-events: none;
	}
	.indeterminate-indicator {
		border-radius: 2px;
		background: ${ve};
		position: absolute;
		top: 50%;
		left: 50%;
		width: 50%;
		height: 50%;
		transform: translate(-50%, -50%);
		opacity: 0;
	}
	:host(:enabled) .control:hover {
		background: ${ut};
		border-color: ${Pn};
	}
	:host(:enabled) .control:active {
		background: ${ut};
		border-color: ${W};
	}
	:host(:${be}) .control {
		border: calc(${M} * 1px) solid ${W};
	}
	:host(.disabled) .label,
	:host(.readonly) .label,
	:host(.readonly) .control,
	:host(.disabled) .control {
		cursor: ${zt};
	}
	:host(.checked:not(.indeterminate)) .checked-indicator,
	:host(.indeterminate) .indeterminate-indicator {
		opacity: 1;
	}
	:host(.disabled) {
		opacity: ${yn};
	}
`;class Uy extends is{connectedCallback(){super.connectedCallback(),this.textContent?this.setAttribute("aria-label",this.textContent):this.setAttribute("aria-label","Checkbox")}}const Wy=Uy.compose({baseName:"checkbox",template:bv,styles:jy,checkedIndicator:`
		<svg 
			part="checked-indicator"
			class="checked-indicator"
			width="16" 
			height="16" 
			viewBox="0 0 16 16" 
			xmlns="http://www.w3.org/2000/svg" 
			fill="currentColor"
		>
			<path 
				fill-rule="evenodd" 
				clip-rule="evenodd" 
				d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"
			/>
		</svg>
	`,indeterminateIndicator:`
		<div part="indeterminate-indicator" class="indeterminate-indicator"></div>
	`}),Qy=(t,e)=>X`
	:host {
		display: flex;
		position: relative;
		flex-direction: column;
		width: 100%;
	}
`,qy=(t,e)=>X`
	:host {
		display: grid;
		padding: calc((${D} / 4) * 1px) 0;
		box-sizing: border-box;
		width: 100%;
		background: transparent;
	}
	:host(.header) {
	}
	:host(.sticky-header) {
		background: ${hy};
		position: sticky;
		top: 0;
	}
	:host(:hover) {
		background: ${Ey};
		outline: 1px dotted ${Rf};
		outline-offset: -1px;
	}
`,Gy=(t,e)=>X`
	:host {
		padding: calc(${D} * 1px) calc(${D} * 3px);
		color: ${ve};
		opacity: 1;
		box-sizing: border-box;
		font-family: ${Ge};
		font-size: ${Ee};
		line-height: ${_e};
		font-weight: 400;
		border: solid calc(${M} * 1px) transparent;
		border-radius: calc(${cn} * 1px);
		white-space: wrap;
		overflow-wrap: anywhere;
	}
	:host(.column-header) {
		font-weight: 600;
	}
	:host(:${be}),
	:host(:focus),
	:host(:active) {
		background: ${Zt};
		border: solid calc(${M} * 1px) ${W};
		color: ${Un};
		outline: none;
	}
	:host(:${be}) ::slotted(*),
	:host(:focus) ::slotted(*),
	:host(:active) ::slotted(*) {
		color: ${Un} !important;
	}
`;class Yy extends ie{connectedCallback(){super.connectedCallback(),this.getAttribute("aria-label")||this.setAttribute("aria-label","Data Grid")}}const Xy=Yy.compose({baseName:"data-grid",baseClass:ie,template:hv,styles:Qy});class Zy extends we{}const Jy=Zy.compose({baseName:"data-grid-row",baseClass:we,template:vv,styles:qy});class Ky extends jt{}const e0=Ky.compose({baseName:"data-grid-cell",baseClass:jt,template:yv,styles:Gy}),t0=(t,e)=>X`
	${xe("block")} :host {
		border: none;
		border-top: calc(${M} * 1px) solid ${Ty};
		box-sizing: content-box;
		height: 0;
		margin: calc(${D} * 1px) 0;
		width: 100%;
	}
`;class n0 extends Ya{}const i0=n0.compose({baseName:"divider",template:Lv,styles:t0}),r0=(t,e)=>X`
	${xe("inline-flex")} :host {
		background: ${Gr};
		box-sizing: border-box;
		color: ${ve};
		contain: contents;
		font-family: ${Ge};
		height: calc(${ao} * 1px);
		position: relative;
		user-select: none;
		min-width: ${Ka};
		outline: none;
		vertical-align: top;
	}
	.control {
		align-items: center;
		box-sizing: border-box;
		border: calc(${M} * 1px) solid ${At};
		border-radius: calc(${cn} * 1px);
		cursor: pointer;
		display: flex;
		font-family: inherit;
		font-size: ${Ee};
		line-height: ${_e};
		min-height: 100%;
		padding: 2px 6px 2px 8px;
		width: 100%;
	}
	.listbox {
		background: ${Gr};
		border: calc(${M} * 1px) solid ${W};
		border-radius: calc(${cn} * 1px);
		box-sizing: border-box;
		display: inline-flex;
		flex-direction: column;
		left: 0;
		max-height: ${Iy};
		padding: 0 0 calc(${D} * 1px) 0;
		overflow-y: auto;
		position: absolute;
		width: 100%;
		z-index: 1;
	}
	.listbox[hidden] {
		display: none;
	}
	:host(:${be}) .control {
		border-color: ${W};
	}
	:host(:not([disabled]):hover) {
		background: ${Gr};
		border-color: ${At};
	}
	:host(:${be}) ::slotted([aria-selected="true"][role="option"]:not([disabled])) {
		background: ${Zt};
		border: calc(${M} * 1px) solid ${W};
		color: ${Un};
	}
	:host([disabled]) {
		cursor: ${zt};
		opacity: ${yn};
	}
	:host([disabled]) .control {
		cursor: ${zt};
		user-select: none;
	}
	:host([disabled]:hover) {
		background: ${Gr};
		color: ${ve};
		fill: currentcolor;
	}
	:host(:not([disabled])) .control:active {
		border-color: ${W};
	}
	:host(:empty) .listbox {
		display: none;
	}
	:host([open]) .control {
		border-color: ${W};
	}
	:host([open][position='above']) .listbox,
	:host([open][position='below']) .control {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}
	:host([open][position='above']) .control,
	:host([open][position='below']) .listbox {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}
	:host([open][position='above']) .listbox {
		bottom: calc(${ao} * 1px);
	}
	:host([open][position='below']) .listbox {
		top: calc(${ao} * 1px);
	}
	.selected-value {
		flex: 1 1 auto;
		font-family: inherit;
		overflow: hidden;
		text-align: start;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.indicator {
		flex: 0 0 auto;
		margin-inline-start: 1em;
	}
	slot[name='listbox'] {
		display: none;
		width: 100%;
	}
	:host([open]) slot[name='listbox'] {
		display: flex;
		position: absolute;
	}
	.end {
		margin-inline-start: auto;
	}
	.start,
	.end,
	.indicator,
	.select-indicator,
	::slotted(svg),
	::slotted(span) {
		fill: currentcolor;
		height: 1em;
		min-height: calc(${D} * 4px);
		min-width: calc(${D} * 4px);
		width: 1em;
	}
	::slotted([role='option']),
	::slotted(option) {
		flex: 0 0 auto;
	}
`;class o0 extends Wt{}const s0=o0.compose({baseName:"dropdown",template:Yv,styles:r0,indicator:`
		<svg 
			class="select-indicator"
			part="select-indicator"
			width="16" 
			height="16" 
			viewBox="0 0 16 16" 
			xmlns="http://www.w3.org/2000/svg" 
			fill="currentColor"
		>
			<path 
				fill-rule="evenodd" 
				clip-rule="evenodd" 
				d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
			/>
		</svg>
	`}),l0=(t,e)=>X`
	${xe("inline-flex")} :host {
		background: transparent;
		box-sizing: border-box;
		color: ${Oy};
		cursor: pointer;
		fill: currentcolor;
		font-family: ${Ge};
		font-size: ${Ee};
		line-height: ${_e};
		outline: none;
	}
	.control {
		background: transparent;
		border: calc(${M} * 1px) solid transparent;
		border-radius: calc(${cn} * 1px);
		box-sizing: border-box;
		color: inherit;
		cursor: inherit;
		fill: inherit;
		font-family: inherit;
		height: inherit;
		padding: 0;
		outline: none;
		text-decoration: none;
		word-break: break-word;
	}
	.control::-moz-focus-inner {
		border: 0;
	}
	:host(:hover) {
		color: ${Kc};
	}
	:host(:hover) .content {
		text-decoration: underline;
	}
	:host(:active) {
		background: transparent;
		color: ${Kc};
	}
	:host(:${be}) .control,
	:host(:focus) .control {
		border: calc(${M} * 1px) solid ${W};
	}
`;class a0 extends et{}const u0=a0.compose({baseName:"link",template:sv,styles:l0,shadowOptions:{delegatesFocus:!0}}),c0=(t,e)=>X`
	${xe("inline-flex")} :host {
		font-family: var(--body-font);
		border-radius: ${cn};
		border: calc(${M} * 1px) solid transparent;
		box-sizing: border-box;
		color: ${ve};
		cursor: pointer;
		fill: currentcolor;
		font-size: ${Ee};
		line-height: ${_e};
		margin: 0;
		outline: none;
		overflow: hidden;
		padding: 0 calc((${D} / 2) * 1px)
			calc((${D} / 4) * 1px);
		user-select: none;
		white-space: nowrap;
	}
	:host(:${be}) {
		border-color: ${W};
		background: ${Zt};
		color: ${ve};
	}
	:host([aria-selected='true']) {
		background: ${Zt};
		border: calc(${M} * 1px) solid ${W};
		color: ${Un};
	}
	:host(:active) {
		background: ${Zt};
		color: ${Un};
	}
	:host(:not([aria-selected='true']):hover) {
		background: ${Zt};
		border: calc(${M} * 1px) solid ${W};
		color: ${Un};
	}
	:host(:not([aria-selected='true']):active) {
		background: ${Zt};
		color: ${ve};
	}
	:host([disabled]) {
		cursor: ${zt};
		opacity: ${yn};
	}
	:host([disabled]:hover) {
		background-color: inherit;
	}
	.content {
		grid-column-start: 2;
		justify-self: start;
		overflow: hidden;
		text-overflow: ellipsis;
	}
`;class d0 extends vt{connectedCallback(){super.connectedCallback(),this.textContent?this.setAttribute("aria-label",this.textContent):this.setAttribute("aria-label","Option")}}const h0=d0.compose({baseName:"option",template:Fv,styles:c0}),f0=(t,e)=>X`
	${xe("grid")} :host {
		box-sizing: border-box;
		font-family: ${Ge};
		font-size: ${Ee};
		line-height: ${_e};
		color: ${ve};
		grid-template-columns: auto 1fr auto;
		grid-template-rows: auto 1fr;
		overflow-x: auto;
	}
	.tablist {
		display: grid;
		grid-template-rows: auto auto;
		grid-template-columns: auto;
		column-gap: calc(${D} * 8px);
		position: relative;
		width: max-content;
		align-self: end;
		padding: calc(${D} * 1px) calc(${D} * 1px) 0;
		box-sizing: border-box;
	}
	.start,
	.end {
		align-self: center;
	}
	.activeIndicator {
		grid-row: 2;
		grid-column: 1;
		width: 100%;
		height: calc((${D} / 4) * 1px);
		justify-self: center;
		background: ${Cn};
		margin: 0;
		border-radius: calc(${cn} * 1px);
	}
	.activeIndicatorTransition {
		transition: transform 0.01s linear;
	}
	.tabpanel {
		grid-row: 2;
		grid-column-start: 1;
		grid-column-end: 4;
		position: relative;
	}
`,p0=(t,e)=>X`
	${xe("inline-flex")} :host {
		box-sizing: border-box;
		font-family: ${Ge};
		font-size: ${Ee};
		line-height: ${_e};
		height: calc(${D} * 7px);
		padding: calc(${D} * 1px) 0;
		color: ${Dy};
		fill: currentcolor;
		border-radius: calc(${cn} * 1px);
		border: solid calc(${M} * 1px) transparent;
		align-items: center;
		justify-content: center;
		grid-row: 1;
		cursor: pointer;
	}
	:host(:hover) {
		color: ${Cn};
		fill: currentcolor;
	}
	:host(:active) {
		color: ${Cn};
		fill: currentcolor;
	}
	:host([aria-selected='true']) {
		background: transparent;
		color: ${Cn};
		fill: currentcolor;
	}
	:host([aria-selected='true']:hover) {
		background: transparent;
		color: ${Cn};
		fill: currentcolor;
	}
	:host([aria-selected='true']:active) {
		background: transparent;
		color: ${Cn};
		fill: currentcolor;
	}
	:host(:${be}) {
		outline: none;
		border: solid calc(${M} * 1px) ${Py};
	}
	:host(:focus) {
		outline: none;
	}
	::slotted(vscode-badge) {
		margin-inline-start: calc(${D} * 2px);
	}
`,m0=(t,e)=>X`
	${xe("flex")} :host {
		color: inherit;
		background-color: transparent;
		border: solid calc(${M} * 1px) transparent;
		box-sizing: border-box;
		font-size: ${Ee};
		line-height: ${_e};
		padding: 10px calc((${D} + 2) * 1px);
	}
`;class g0 extends yt{connectedCallback(){super.connectedCallback(),this.orientation&&(this.orientation=Ml.horizontal),this.getAttribute("aria-label")||this.setAttribute("aria-label","Panels")}}const v0=g0.compose({baseName:"panels",template:Kv,styles:f0});class y0 extends Tf{connectedCallback(){super.connectedCallback(),this.disabled&&(this.disabled=!1),this.textContent&&this.setAttribute("aria-label",this.textContent)}}const b0=y0.compose({baseName:"panel-tab",template:Jv,styles:p0});class w0 extends Zv{}const x0=w0.compose({baseName:"panel-view",template:Xv,styles:m0}),k0=(t,e)=>X`
	${xe("flex")} :host {
		align-items: center;
		outline: none;
		height: calc(${D} * 7px);
		width: calc(${D} * 7px);
		margin: 0;
	}
	.progress {
		height: 100%;
		width: 100%;
	}
	.background {
		fill: none;
		stroke: transparent;
		stroke-width: calc(${D} / 2 * 1px);
	}
	.indeterminate-indicator-1 {
		fill: none;
		stroke: ${Ry};
		stroke-width: calc(${D} / 2 * 1px);
		stroke-linecap: square;
		transform-origin: 50% 50%;
		transform: rotate(-90deg);
		transition: all 0.2s ease-in-out;
		animation: spin-infinite 2s linear infinite;
	}
	@keyframes spin-infinite {
		0% {
			stroke-dasharray: 0.01px 43.97px;
			transform: rotate(0deg);
		}
		50% {
			stroke-dasharray: 21.99px 21.99px;
			transform: rotate(450deg);
		}
		100% {
			stroke-dasharray: 0.01px 43.97px;
			transform: rotate(1080deg);
		}
	}
`;class C0 extends di{connectedCallback(){super.connectedCallback(),this.paused&&(this.paused=!1),this.setAttribute("aria-label","Loading"),this.setAttribute("aria-live","assertive"),this.setAttribute("role","alert")}attributeChangedCallback(e,n,i){e==="value"&&this.removeAttribute("value")}}const $0=C0.compose({baseName:"progress-ring",template:Vv,styles:k0,indeterminateIndicator:`
		<svg class="progress" part="progress" viewBox="0 0 16 16">
			<circle
				class="background"
				part="background"
				cx="8px"
				cy="8px"
				r="7px"
			></circle>
			<circle
				class="indeterminate-indicator-1"
				part="indeterminate-indicator-1"
				cx="8px"
				cy="8px"
				r="7px"
			></circle>
		</svg>
	`}),S0=(t,e)=>X`
	${xe("flex")} :host {
		align-items: flex-start;
		margin: calc(${D} * 1px) 0;
		flex-direction: column;
	}
	.positioning-region {
		display: flex;
		flex-wrap: wrap;
	}
	:host([orientation='vertical']) .positioning-region {
		flex-direction: column;
	}
	:host([orientation='horizontal']) .positioning-region {
		flex-direction: row;
	}
	::slotted([slot='label']) {
		color: ${ve};
		font-size: ${Ee};
		margin: calc(${D} * 1px) 0;
	}
`;class E0 extends Ut{connectedCallback(){super.connectedCallback();const e=this.querySelector("label");if(e){const n="radio-group-"+Math.random().toString(16).slice(2);e.setAttribute("id",n),this.setAttribute("aria-labelledby",n)}}}const T0=E0.compose({baseName:"radio-group",template:Hv,styles:S0}),I0=(t,e)=>X`
	${xe("inline-flex")} :host {
		align-items: center;
		flex-direction: row;
		font-size: ${Ee};
		line-height: ${_e};
		margin: calc(${D} * 1px) 0;
		outline: none;
		position: relative;
		transition: all 0.2s ease-in-out;
		user-select: none;
	}
	.control {
		background: ${ut};
		border-radius: 999px;
		border: calc(${M} * 1px) solid ${Pn};
		box-sizing: border-box;
		cursor: pointer;
		height: calc(${D} * 4px);
		position: relative;
		outline: none;
		width: calc(${D} * 4px);
	}
	.label {
		color: ${ve};
		cursor: pointer;
		font-family: ${Ge};
		margin-inline-end: calc(${D} * 2px + 2px);
		padding-inline-start: calc(${D} * 2px + 2px);
	}
	.label__hidden {
		display: none;
		visibility: hidden;
	}
	.control,
	.checked-indicator {
		flex-shrink: 0;
	}
	.checked-indicator {
		background: ${ve};
		border-radius: 999px;
		display: inline-block;
		inset: calc(${D} * 1px);
		opacity: 0;
		pointer-events: none;
		position: absolute;
	}
	:host(:not([disabled])) .control:hover {
		background: ${ut};
		border-color: ${Pn};
	}
	:host(:not([disabled])) .control:active {
		background: ${ut};
		border-color: ${W};
	}
	:host(:${be}) .control {
		border: calc(${M} * 1px) solid ${W};
	}
	:host([aria-checked='true']) .control {
		background: ${ut};
		border: calc(${M} * 1px) solid ${Pn};
	}
	:host([aria-checked='true']:not([disabled])) .control:hover {
		background: ${ut};
		border: calc(${M} * 1px) solid ${Pn};
	}
	:host([aria-checked='true']:not([disabled])) .control:active {
		background: ${ut};
		border: calc(${M} * 1px) solid ${W};
	}
	:host([aria-checked="true"]:${be}:not([disabled])) .control {
		border: calc(${M} * 1px) solid ${W};
	}
	:host([disabled]) .label,
	:host([readonly]) .label,
	:host([readonly]) .control,
	:host([disabled]) .control {
		cursor: ${zt};
	}
	:host([aria-checked='true']) .checked-indicator {
		opacity: 1;
	}
	:host([disabled]) {
		opacity: ${yn};
	}
`;class O0 extends os{connectedCallback(){super.connectedCallback(),this.textContent?this.setAttribute("aria-label",this.textContent):this.setAttribute("aria-label","Radio")}}const R0=O0.compose({baseName:"radio",template:jv,styles:I0,checkedIndicator:`
		<div part="checked-indicator" class="checked-indicator"></div>
	`}),P0=(t,e)=>X`
	${xe("inline-block")} :host {
		box-sizing: border-box;
		font-family: ${Ge};
		font-size: ${Pf};
		line-height: ${Df};
	}
	.control {
		background-color: ${Af};
		border: calc(${M} * 1px) solid ${eu};
		border-radius: ${Ay};
		color: ${_f};
		padding: calc(${D} * 0.5px) calc(${D} * 1px);
		text-transform: uppercase;
	}
`;class D0 extends Er{connectedCallback(){super.connectedCallback(),this.circular&&(this.circular=!1)}}const A0=D0.compose({baseName:"tag",template:wf,styles:P0}),_0=(t,e)=>X`
	${xe("inline-block")} :host {
		font-family: ${Ge};
		outline: none;
		user-select: none;
	}
	.control {
		box-sizing: border-box;
		position: relative;
		color: ${Ff};
		background: ${rn};
		border-radius: calc(${Ja} * 1px);
		border: calc(${M} * 1px) solid ${At};
		font: inherit;
		font-size: ${Ee};
		line-height: ${_e};
		padding: calc(${D} * 2px + 1px);
		width: 100%;
		min-width: ${Ka};
		resize: none;
	}
	.control:hover:enabled {
		background: ${rn};
		border-color: ${At};
	}
	.control:active:enabled {
		background: ${rn};
		border-color: ${W};
	}
	.control:hover,
	.control:${be},
	.control:disabled,
	.control:active {
		outline: none;
	}
	.control::-webkit-scrollbar {
		width: ${fy};
		height: ${py};
	}
	.control::-webkit-scrollbar-corner {
		background: ${rn};
	}
	.control::-webkit-scrollbar-thumb {
		background: ${my};
	}
	.control::-webkit-scrollbar-thumb:hover {
		background: ${gy};
	}
	.control::-webkit-scrollbar-thumb:active {
		background: ${vy};
	}
	:host(:focus-within:not([disabled])) .control {
		border-color: ${W};
	}
	:host([resize='both']) .control {
		resize: both;
	}
	:host([resize='horizontal']) .control {
		resize: horizontal;
	}
	:host([resize='vertical']) .control {
		resize: vertical;
	}
	.label {
		display: block;
		color: ${ve};
		cursor: pointer;
		font-size: ${Ee};
		line-height: ${_e};
		margin-bottom: 2px;
	}
	.label__hidden {
		display: none;
		visibility: hidden;
	}
	:host([disabled]) .label,
	:host([readonly]) .label,
	:host([readonly]) .control,
	:host([disabled]) .control {
		cursor: ${zt};
	}
	:host([disabled]) {
		opacity: ${yn};
	}
	:host([disabled]) .control {
		border-color: ${At};
	}
`;class L0 extends Ie{connectedCallback(){super.connectedCallback(),this.textContent?this.setAttribute("aria-label",this.textContent):this.setAttribute("aria-label","Text area")}}const N0=L0.compose({baseName:"text-area",template:ny,styles:_0,shadowOptions:{delegatesFocus:!0}}),F0=(t,e)=>X`
	${xe("inline-block")} :host {
		font-family: ${Ge};
		outline: none;
		user-select: none;
	}
	.root {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: row;
		color: ${Ff};
		background: ${rn};
		border-radius: calc(${Ja} * 1px);
		border: calc(${M} * 1px) solid ${At};
		height: calc(${ao} * 1px);
		min-width: ${Ka};
	}
	.control {
		-webkit-appearance: none;
		font: inherit;
		background: transparent;
		border: 0;
		color: inherit;
		height: calc(100% - (${D} * 1px));
		width: 100%;
		margin-top: auto;
		margin-bottom: auto;
		border: none;
		padding: 0 calc(${D} * 2px + 1px);
		font-size: ${Ee};
		line-height: ${_e};
	}
	.control:hover,
	.control:${be},
	.control:disabled,
	.control:active {
		outline: none;
	}
	.label {
		display: block;
		color: ${ve};
		cursor: pointer;
		font-size: ${Ee};
		line-height: ${_e};
		margin-bottom: 2px;
	}
	.label__hidden {
		display: none;
		visibility: hidden;
	}
	.start,
	.end {
		display: flex;
		margin: auto;
		fill: currentcolor;
	}
	::slotted(svg),
	::slotted(span) {
		width: calc(${D} * 4px);
		height: calc(${D} * 4px);
	}
	.start {
		margin-inline-start: calc(${D} * 2px);
	}
	.end {
		margin-inline-end: calc(${D} * 2px);
	}
	:host(:hover:not([disabled])) .root {
		background: ${rn};
		border-color: ${At};
	}
	:host(:active:not([disabled])) .root {
		background: ${rn};
		border-color: ${W};
	}
	:host(:focus-within:not([disabled])) .root {
		border-color: ${W};
	}
	:host([disabled]) .label,
	:host([readonly]) .label,
	:host([readonly]) .control,
	:host([disabled]) .control {
		cursor: ${zt};
	}
	:host([disabled]) {
		opacity: ${yn};
	}
	:host([disabled]) .control {
		border-color: ${At};
	}
`;class B0 extends Be{connectedCallback(){super.connectedCallback(),this.textContent?this.setAttribute("aria-label",this.textContent):this.setAttribute("aria-label","Text field")}}const M0=B0.compose({baseName:"text-field",template:iy,styles:F0,shadowOptions:{delegatesFocus:!0}}),{wrap:re}=uy(md,cy());re(Ny(),{name:"vscode-badge"});const z0=re(Hy(),{name:"vscode-button"});re(Wy(),{name:"vscode-checkbox",events:{onChange:"change"}});re(Xy(),{name:"vscode-data-grid"});re(e0(),{name:"vscode-data-grid-cell"});re(Jy(),{name:"vscode-data-grid-row"});re(i0(),{name:"vscode-divider"});re(s0(),{name:"vscode-dropdown",events:{onChange:"change"}});re(u0(),{name:"vscode-link"});re(h0(),{name:"vscode-option"});re(v0(),{name:"vscode-panels",events:{onChange:"change"}});re(b0(),{name:"vscode-panel-tab"});re(x0(),{name:"vscode-panel-view"});re($0(),{name:"vscode-progress-ring"});re(R0(),{name:"vscode-radio",events:{onChange:"change"}});re(T0(),{name:"vscode-radio-group",events:{onChange:"change"}});re(A0(),{name:"vscode-tag"});re(N0(),{name:"vscode-text-area",events:{onChange:"change",onInput:"input"}});re(M0(),{name:"vscode-text-field",events:{onChange:"change",onInput:"input"}});var tu={exports:{}},Ir={};/** @license React v17.0.2
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var V0=Bo.exports,Mf=60103;Ir.Fragment=60107;if(typeof Symbol=="function"&&Symbol.for){var ed=Symbol.for;Mf=ed("react.element"),Ir.Fragment=ed("react.fragment")}var H0=V0.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,j0=Object.prototype.hasOwnProperty,U0={key:!0,ref:!0,__self:!0,__source:!0};function zf(t,e,n){var i,r={},o=null,s=null;n!==void 0&&(o=""+n),e.key!==void 0&&(o=""+e.key),e.ref!==void 0&&(s=e.ref);for(i in e)j0.call(e,i)&&!U0.hasOwnProperty(i)&&(r[i]=e[i]);if(t&&t.defaultProps)for(i in e=t.defaultProps,e)r[i]===void 0&&(r[i]=e[i]);return{$$typeof:Mf,type:t,key:o,ref:s,props:r,_owner:H0.current}}Ir.jsx=zf;Ir.jsxs=zf;tu.exports=Ir;const Fo=tu.exports.jsx,W0=tu.exports.jsxs;function Q0(){function t(){Xm.postMessage({command:"hello",value:"Hey there partner! \u{1F920}"})}return W0("main",{children:[Fo("h1",{children:"Hello World!"}),Fo(z0,{onClick:t,children:"Howdy!"})]})}Gm.render(Fo(md.StrictMode,{children:Fo(Q0,{})}),document.getElementById("root"));
