import cv2,numpy as np,json,sys
R=1.000081;C=-14.95668
cap=cv2.VideoCapture('in/video.mp4');fps=cap.get(cv2.CAP_PROP_FPS)
start,end=float(sys.argv[1]),float(sys.argv[2])
cap.set(cv2.CAP_PROP_POS_FRAMES,round(start*fps));n=round(start*fps)
dets=[]
while True:
  ok,f=cap.read()
  if not ok or n/fps>end:break
  t=n/fps;n+=1
  f=cv2.resize(f,(854,480));hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
  cm=((hsv[...,0]>=80)&(hsv[...,0]<=100)&(hsv[...,1]>110)&(hsv[...,2]>150)).astype(np.uint8)
  cm[:, :55]=0;cm[:,798:]=0;cm[:40,500:]=0
  cs,_=cv2.findContours(cm,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  for c in cs:
    ar=cv2.contourArea(c)
    if not 25<ar<500:continue
    hull=cv2.convexHull(c);sol=ar/max(cv2.contourArea(hull),1)
    ap=cv2.approxPolyDP(hull,0.12*cv2.arcLength(hull,True),True)
    if len(ap)!=3 or sol<0.75:continue
    M=cv2.moments(c);cx,cy=M['m10']/M['m00'],M['m01']/M['m00']
    # tip = vertex farthest from centroid
    pts=ap[:,0,:].astype(float);tip=pts[np.argmax(((pts-[cx,cy])**2).sum(1))]
    dets.append({'tv':t,'g':R*t+C,'x':cx,'y':cy,'tip':tip.tolist(),'area':ar})
json.dump(dets,open(sys.argv[3],'w'))
print(len(dets))
