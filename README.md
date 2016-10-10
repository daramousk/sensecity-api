##sense.city API

Sensecity is an **API** that collect problem issues from a city about the Plumbing, Lighting, Roads , Cleanliness and the mood for people that live there.

The purpose is to sent problems issues from people in real time through smart devices and other smart sencor.

The data that we collect, until now is the avove problem issues, is open and everyone can get and processing them.

##Installing

Install dependencies
```
 npm install
```

##Configuring MongoDB



##Default API Endpoint
### Get Method
```
API Endpoint : http://api.sense.city:3000/api/issue
```


##Variables:


| Variable | value | example | default value |
| --- | :-------------: | :---: | :---: |
| **startdate** | date time format  | YYYY-mm-DD <br>```2016-03-22```| today minus 3 day |
| **enddate** | date time format |  YYYY-mm-DD <br>```2016-03-22```  | today |
| **coordinates** | Latitude,Longitude | [Longitude,Latitude]<br>```[21.734574,38.2466395]``` |  with no specific coordinates |
| **distance** | meters | Integer<br>1km = ```1000```|  with no value of a distance |
| **issue** | garbage,plumbing,lighting,road |  |  all issues |
| **limit** | Integer (5,10,20,30,100,...) <br>Returns records | 5<br>25 etc |  1000 |
| **sort** | Integer (1,-1)<br>*1:oldest to newest<br>*-1:newest to oldest  |  |  newest to oldest |
  
##Examples

```

http://api.sense.city:3000/api/issue?startdate=2016-03-22&enddate=2016-03-30&coordinates=[21.734574,38.2466395]&distance=15000&sort=-1&limit=20&issue=garbage

```

## API Endpoint
### Get Method with specific city
```
API Endpoint : http://api.sense.city:3000/api/issue/cityname
```


##Variables:


| Variable | value | example | default value |
| --- | :-------------: | :---: | :---: |
| **startdate** | date time format  | YYYY-mm-DD <br>```2016-03-22```| today minus 3 day |
| **enddate** | date time format |  YYYY-mm-DD <br>```2016-03-22```  | today |
| **coordinates** | Latitude,Longitude | [Longitude,Latitude]<br>```[21.734574,38.2466395]``` |  with no specific coordinates |
| **distance** | meters | Integer<br>1km = ```1000```|  with no value of a distance |
| **issue** | garbage,plumbing,lighting,road |  |  all issues |
| **limit** | Integer (5,10,20,30,100,...) <br>Returns records | 5<br>25 etc |  1000 |
| **sort** | Integer (1,-1)<br>*1:oldest to newest<br>*-1:newest to oldest  |  |  newest to oldest |
  
##Examples

```

http://api.sense.city:3000/api/issue/patras?startdate=2016-03-22&enddate=2016-03-30&coordinates=[21.734574,38.2466395]&distance=15000&sort=-1&limit=20&issue=garbage

```

## API Endpoint
### Post Method 
```
API Endpoint : http://api.sense.city:3000/api/issue
```

## Data

 {"loc" : { 
            "type" : "Point",  
            "coordinates" : [longitude,lattitude] 
            }, 
   "issue" : "",
   "device_id" : "String", 
   "value_desc" : "String",
   "image_name" : "image base64" 
  }
  
  Issue Values :
  
      a) garbage
      b) lighting
      c) plumbing
      d) road-contructor
      e) happy (syntax with no value_desc & image_name)
      f) neutral (syntax with no value_desc & image_name)
      g) angry (syntax with no value_desc & image_name)

## Example (jQuery) 

...

    $.ajax({
            type: "POST",
            url: "http://api.sense.city:3000/api/issue",
            data: '{"loc" : { "type" : "Point",  "coordinates" : [21.256995,38.256695] }, "issue" : "happy","device_id" : "webapp", "value_desc" : "","image_name" : "no-image" }',
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data){
                //YOUR CODE HERE
            }
        });

...

