// Local integration test. Creates only isolated QA accounts/keys/images and removes them.
const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {encode}=require('next-auth/jwt');const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}), emails=[],paths=[];
 const base=process.env.BASE_URL||'http://localhost:3000';
 async function account(){const email=`qa-${randomUUID()}@example.invalid`;emails.push(email);return 'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{email,name:'QA'}})}
 try{
  assert.equal((await fetch(base+'/api/developer/keys')).status,401)
  assert.equal((await fetch(base+'/api/notes/images',{method:'POST'})).status,401)
  const cookie=await account(), other=await account();const headers={cookie,origin:base,'content-type':'application/json'}
  const created=await fetch(base+'/api/developer/keys',{method:'POST',headers,body:JSON.stringify({name:'QA key'})});assert.equal(created.status,201)
  const {key}=await created.json();assert.match(key,/^lmb_/)
  const listing=await (await fetch(base+'/api/developer/keys',{headers:{cookie}})).json();const row=listing.keys[0];assert(!('key_hash' in row));assert(!JSON.stringify(listing).includes(key))
  const api=await fetch(base+'/api/v1/planners?limit=1',{headers:{authorization:`Bearer ${key}`}});assert.equal(api.status,200);const publicData=await api.json();assert(Array.isArray(publicData.data));assert(!JSON.stringify(publicData).includes('user_id'))
  const decks=await fetch(base+'/api/v1/decks?limit=1',{headers:{authorization:`Bearer ${key}`}});assert.equal(decks.status,200)
  assert.equal((await fetch(base+'/api/v1/identities',{headers:{authorization:`Bearer ${key}`}})).status,403)
  const owner=(await db.schema('limbus').from('developer_keys').select('user_id').eq('id',row.id).single()).data.user_id
  await db.schema('limbus').from('profiles').update({partner:'limpi'}).eq('id',owner)
  const catalog=await fetch(base+'/api/v1/identities?lang=en',{headers:{authorization:`Bearer ${key}`}});assert.equal(catalog.status,200);assert.equal(catalog.headers.get('x-ratelimit-remaining'),null)
  const identity=(await catalog.json()).data[0];assert(identity.url.includes('/en/sinners/'));assert(!('name_kr' in identity))
  assert.equal((await (await fetch(base+'/api/developer/keys',{headers:{cookie}})).json()).partner.code,'limpi')
  await fetch(base+'/api/developer/keys',{method:'DELETE',headers:{...headers,cookie:other},body:JSON.stringify({id:row.id})})
  assert.equal((await fetch(base+'/api/v1/planners',{headers:{authorization:`Bearer ${key}`}})).status,200)
  await fetch(base+'/api/developer/keys',{method:'DELETE',headers,body:JSON.stringify({id:row.id})})
  assert.equal((await fetch(base+'/api/v1/planners',{headers:{authorization:`Bearer ${key}`}})).status,401)
  assert.equal((await fetch(base+'/api/developer/keys',{method:'POST',headers:{...headers,origin:'https://other.test'},body:'{}'})).status,403)
  const sharp=require('sharp');const bytes=await sharp({create:{width:32,height:32,channels:3,background:'#e5c85a'}}).png().toBuffer();const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'qa.png')
  const upload=await fetch(base+'/api/notes/images',{method:'POST',headers:{cookie,origin:base},body:form});assert.equal(upload.status,201);const {url}=await upload.json();paths.push(url.split('/limbus-assets/')[1]);assert.equal((await fetch(url)).status,200)
  const mine=await (await fetch(base+'/api/community/me',{headers:{cookie}})).json(), theirs=await (await fetch(base+'/api/community/me',{headers:{cookie:other}})).json();
  const followUrl=base+'/api/community/profiles/'+theirs.profile.id+'/follows';
  assert.equal((await fetch(followUrl,{method:'POST'})).status,401);
  assert.equal((await fetch(followUrl,{method:'POST',headers:{cookie,origin:'https://other.test'}})).status,403);
  for(const token of [cookie,other]){const r=await fetch(base+'/api/community/me',{method:'PATCH',headers:{cookie:token,origin:base,'content-type':'application/json'},body:JSON.stringify({public_profile:true,public_following:false,public_followers:false})});assert.equal(r.status,200)}
  assert.equal((await fetch(followUrl,{method:'POST',headers:{cookie,origin:base}})).status,200);
  assert.equal((await fetch(followUrl,{method:'POST',headers:{cookie,origin:base}})).status,200);
  let follows=await (await fetch(followUrl+'?kind=followers')).json();assert.equal(follows.can_view,false);assert.equal(follows.follower_count,null);assert.deepEqual(follows.items,[]);
  follows=await (await fetch(followUrl+'?kind=followers',{headers:{cookie:other}})).json();assert.equal(follows.follower_count,1);assert.equal(follows.items[0].id,mine.profile.id);assert(!('email' in follows.items[0]));
  assert.equal((await fetch(base+'/api/community/me',{method:'PATCH',headers:{cookie:other,origin:base,'content-type':'application/json'},body:'{"public_followers":true}'})).status,200);
  follows=await (await fetch(followUrl+'?kind=followers')).json();assert.equal(follows.can_view,true);assert.equal(follows.items.length,1);assert.equal(follows.following_count,null);
  assert.equal((await fetch(followUrl,{method:'DELETE',headers:{cookie,origin:base}})).status,200);
  follows=await (await fetch(followUrl+'?kind=followers')).json();assert.equal(follows.follower_count,0);
  console.log('PASS: follow auth/origin, idempotence, private list/count, separate visibility, unfollow');
  console.log('PASS: sign-in gate, one-time key, read API, partner gate, owner-only revoke, CSRF, image upload')
 }finally{
  if(paths.length){const {error}=await db.storage.from('limbus-assets').remove(paths);assert.ifError(error)}
  const {data,error}=await db.auth.admin.listUsers({perPage:1000});assert.ifError(error);for(const u of data.users){if(emails.includes(u.email)){const r=await db.auth.admin.deleteUser(u.id);assert.ifError(r.error)}}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
