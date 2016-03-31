
# API Endpoint : http://api.sense.city:3000/api/issue

##Variables:


| Variable | value | example | default value |
| --- | :-------------: | :---: | :---: |
| **startdate** | date time format  | YYYY-mm-DDTHH:MM:SS:msmsmsZ <br>```2016-03-22T11:23:39:151Z```| today minus 3 day |
| **enddate** | date time format |  YYYY-mm-DDTHH:MM:SS:msmsmsZ <br>```2016-03-22T11:23:39:151Z```  | today |
| **coordinates** | Latitude,Longitude | [Longitude,Latitude]<br>```[21.734574,38.2466395]``` |  with no specific coordinates |
| **distance** | meters | Integer<br>1km = ```1000```|  with no value of a distance |
| **issue** | garbage,plumbing,lighting,road |  |  all issues |
| **limit** | Integer (5,10,20,30,100,...) <br>Returns records | 5<br>25 etc |  1000 |
| **sort** | Integer (1,-1)<br>*1:oldest to newest<br>*-1:newest to oldest  |  |  newest to oldest |
  

