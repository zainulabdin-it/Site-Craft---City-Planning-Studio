import {cpSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(`${root}/apps/web/public/cesium`,{recursive:true});
for(const part of ['Assets','Widgets','Workers','ThirdParty'])cpSync(`${root}/node_modules/cesium/Build/Cesium/${part}`,`${root}/apps/web/public/cesium/${part}`,{recursive:true});
