import http from 'node:http';
const port = process.env.PORT || 3000;
http.createServer((req,res)=>{
  if(req.url === '/health'){
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ok:true}));
    return;
  }
  res.end('<a href="/dashboard">Dashboard</a><button onclick="return false">Save</button>');
}).listen(port);
