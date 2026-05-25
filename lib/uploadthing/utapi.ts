let UTApiClass: any = null;
try {
  UTApiClass = require('uploadthing/server').UTApi;
} catch {
  UTApiClass = class {
    async deleteFiles() { return null; }
  };
}

export const utapi = new UTApiClass();
