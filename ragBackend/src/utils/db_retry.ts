const sleep = (ms:number) => new Promise<void>(r=>setTimeout(r,ms));

const TRANSIENT_PRISMA_CODES = new Set(['p1001','p1002','p1008','p1017']);

const isTransientDbError = (err:any):boolean=>{
    return TRANSIENT_PRISMA_CODES.has(err?.code) || err?.name ==="PrismaClientInitializationError"
}

export const retry_db_operation = async<T> (fn : ()=>Promise<T>,{tries=5,baseMs=1000}={}):Promise<T>=>{

    for(let attempt=1; ;attempt++){
        try{
            return await fn();
        }
        catch(err){
            if(!isTransientDbError(err) || attempt>tries){
                throw err;
            }

            const waitTime = baseMs * Math.pow(2, attempt-1);

            console.log(`Transient DB error encountered (attempt ${attempt} of ${tries}). Retrying in ${waitTime} ms...`);

            await sleep(waitTime);
        }
    }
}