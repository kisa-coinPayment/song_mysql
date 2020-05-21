const express = require('express')
const app = express()
const path = require('path')
var jwt = require('jsonwebtoken');
var request = require('request');
var mysql = require('mysql');
var auth = require('./lib/auth');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs'); //select view templet engine

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({extended:false}));

// mysql서버와 연결 추후 외부 서버로 변경 예정 
// aws EC2로 다시 연결 고쳐야함
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '1q2w3e4r',
  database : 'fintech'
});

/*
var connection = mysql.createConnection({
  host : 'fintech.c3hayok504vf.ap-northeast-2.rds.amazonaws.com',
  user : 'fintech',
  password : '1q2w3e4r!',
  database : 'innodb'
})
*/

connection.connect();
console.log('연결중입니다.')




//localhost:3000/ 호출 화면 테스트
app.get('/', function (req, res) {
    var title = 'javascript!'
    res.send('<html><h1>' +title+' </h1><h2>contents</h2></html>')

})
//signup Page 불러오기
app.get('/signup', function(req,res){
    res.render('signup');
})
//login page 불러오기
app.get('/login', function(req, res){
  res.render('login');  
})
//main page 불러오기
app.get('/main', function(req, res){
  res.render('main');
})

app.get('/qr', function(req,res){
  res.render('qrReader');
})

app.get('/withdraw',function(req,res){
  res.render('withdraw');
})




//토큰키 accesstoken, refreshtoken, userseqno를 불러와서 자동으로 회원 가입 페이지(/signup)에 저장 
app.get('/authResult', function(req, res){
    //request, response
    var authCode = req.query.code
    //console.log(authCode);
    var option = {
      method : "POST",
      url: "https://testapi.openbanking.or.kr/oauth/2.0/token",
      header : {
        'Content-Type' : 'application/x-www-form-urlencoded'
      },
      form : {
        code : authCode,
        client_id : 'LrN7dzGrOvwvA1H0DBXpsS0ePpkt4f7LlNKblSZ8',
        client_secret : 'VV3aE9woKLgQEnbbtNWSjIjmmDzbhqeqcczvIIMw',
        redirect_uri : 'http://localhost:3000/authResult',
        grant_type : 'authorization_code'
      }
    }
  
    request(option, function(err, response, body){
      if(err){
          console.error(err);
          throw err;
      }
      else {
          var accessRequestResult = JSON.parse(body);
          //console.log(accessRequestResult);
          
          res.render('resultChild', {data : accessRequestResult} )
      }
  })
    //accesstoken get request
})

//signup페이지에서 회원가입 정보 디비에 저장 
app.post('/signup', function(req, res){
  //data 를 받아서 db에 저장  data req get db store
  //api body에 해당 정보가 있었다
  var userName = req.body.userName;
  var userEmail = req.body.userEmail;
  var userPassword = req.body.userPassword;
  var userAccessToken = req.body.userAccessToken;
  var userRefreshToken = req.body.userRefreshToken;
  var userSeqNo = req.body.userSeqNo;
  //console.log(userName, userAccessToken, userSeqNo);
  var sql = "INSERT INTO fintech.user (name, email, password, accesstoken, refreshtoken, userseqno) VALUES (?,?,?,?,?,?)"
    connection.query(
        sql, // excute sql
        [userName, userEmail, userPassword, userAccessToken, userRefreshToken, userSeqNo], // ? <- value
         function(err, result){
            if(err){
                console.error(err);
                res.json(0);
                throw err;
            }
            else {
                res.json(1)
            }
    })
})


//데이터 받아오니까 post
// login 페이지의 로그인 기능 
app.post('/login',function(req,res){
  var userEmail = req.body.userEmail;
  var userPassword = req.body.userPassword;
  //console.log(userEmail, userPassword);
  var sql = "SELECT * FROM user WHERE email = ?";
  connection.query(sql, [userEmail], function(err,result){
    if(err){
      console.error(err);
      res.json(0);
      throw err;
    } 
    else {
      //console.log(result);
      if(result.length == 0){
        res.json(3)
      }
      else {
        var dbPassword = result[0].password;
        if(dbPassword === userPassword){
          //login sucess
          //토큰 키는 도장이다 jwt는 티켓이다
          var tokenKey = "f@i#n%tne#ckfhlafkd0102test!@#%"
          jwt.sign(
            {
                userId : result[0].id,
                userEmail : result[0].email
            },
            tokenKey,
            {
                expiresIn : '10d',
                issuer : 'fintech.admin',
                subject : 'user.login.info'
            },
            function(err, token){
                //console.log('로그인 성공', token)
                res.json(token)
            }
          )
        }
        else {
          res.json(2);
        }
      }
    }
  })
})

//사용자 정보 조회
app.post('/list', auth, function(req, res){

  // api response body 
  var userId = req.decoded.userId;
  console.log(userId)
  var sql = "SELECT * FROM user WHERE id = ?"
  connection.query(sql,[userId], function(err , result){
      if(err){
          console.error(err);
          throw err
      }
      else {
          console.log(result);
          var option = {
              method : "GET",
              url : "https://testapi.openbanking.or.kr/v2.0/user/me",
              headers : {
                  Authorization : 'Bearer ' + result[0].accesstoken
              },
              qs : {
                  user_seq_no : result[0].userseqno
              }
          }
          request(option, function(err, response, body){
              if(err){
                  console.error(err);
                  throw err;
              }
              else {
                  var accessRequestResult = JSON.parse(body);
                  console.log(accessRequestResult);
                  res.json(accessRequestResult)
              }
          })
      }
  })

})


/*
//출금이체
app.post('/withdraw', auth, function (req, res) {
  var userId = req.decoded.userId;
  var fin_use_num = req.body.fin_use_num;

  var countnum = Math.floor(Math.random() * 1000000000) + 1;
  var transId = "T991629010U" + countnum; //이용기과번호 본인것 입력

  var sql = "SELECT * FROM user WHERE id = ?"
  connection.query(sql,[userId], function(err , result){
      if(err){
          console.error(err);
          throw err
      }
      else {
          console.log(result);
          var option = {
              method : "POST",
              url : "https://testapi.openbanking.or.kr/v2.0/transfer/withdraw/fin_num",
              headers : {
                  Authorization : 'Bearer ' + result[0].accesstoken,
                  "Content-Type" : "application/json"
              },
              json : {
                  "bank_tran_id": transId,
                  "cntr_account_type": "N",
                  "cntr_account_num": "8761487547",
                  "dps_print_content": "쇼핑몰환불",
                  "fintech_use_num": fin_use_num,
                  "wd_print_content": "오픈뱅킹출금",
                  "tran_amt": "1000",
                  "tran_dtime": "20200424131111",
                  "req_client_name": "홍길동",
                  "req_client_fintech_use_num" : "199162901057883963732126",
                  "req_client_num": "HONGGILDONG1234",
                  "transfer_purpose": "TR",
                  "recv_client_name": "진상언",
                  "recv_client_bank_code": "097",
                  "recv_client_account_num": "8761487547"
              }
          }
          request(option, function(err, response, body){
             
            
            // 디비에 들어갈 바디 정보 변수 선언 
            var amount = req.body.amount
            
            //var tran_dtime = req.body.trand_dtime;
            //var tran_amt = req.body.tran_amt;
            
            var sql2 = "INSERT INTO fintech.send (amount) VALUES (?)"


            if(err){
                  console.error(err);
                  throw err;
              }
              else {
                  console.log(body);
                  if(body.rsp_code == 'A0000'){
                      res.json(1)

                      //sql 값 디비에 저장 
                      connection.query(sql2, [amount] ,function(err, result){
                         
                        if(err){
                          console.error(err);
                          res.json(0);
                          throw err;
                        }
                        else {
                          res.json(1);
                        }
                      })
                  }
              }
          })
      }
  })
})
*/


app.post('/withdraw', function(req, res){
  
  var amount = req.body.amount
  
  var sql2 = "INSERT INTO fintech.send(amount)VALUES (?)"


  connection.query(sql2, [amount] ,function(err, result){
                         
    if(err){
      console.error(err);
      res.json(0);
      throw err;
    }
    else {
      res.json(1);
      console.log("good")
    }
  })
})



app.listen(3000)


