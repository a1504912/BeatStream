import json,sys,math,cv2,numpy as np
R=1.000086;C=-12.0936;G0=0.2875;U=0.075
ph={int(k):v for k,v in json.load(open('an/lanephase.json')).items()}
items=json.load(open(sys.argv[1]));out=sys.argv[2];DT=float(sys.argv[3]) if len(sys.argv)>3 else 0.3
cap=cv2.VideoCapture('in/video.mp4');fps=cap.get(cv2.CAP_PROP_FPS)
tiles=[]
for it in items:
  g=G0+U*it['k'];lane=it['lane']
  tvis=(g-U+ph[lane]*U-C)/R
  n=round((tvis-DT)*fps);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read();f=cv2.resize(f,(854,480))
  r=84+301*(tvis-n/fps);a=-math.pi/2+lane*math.pi/4;x,y=int(421.5+r*math.cos(a)),int(232+r*math.sin(a))
  f=cv2.copyMakeBorder(f,40,40,40,40,cv2.BORDER_CONSTANT);c=f[y:y+80,x:x+80].copy()
  c=cv2.resize(c,(120,120));cv2.putText(c,'%.3f L%d'%(g,lane),(2,10),0,0.32,(255,255,255),1)
  tiles.append(c)
cols=8;rows=[np.hstack(tiles[i:i+cols]+[np.zeros((120,120,3),np.uint8)]*(cols-len(tiles[i:i+cols]))) for i in range(0,len(tiles),cols)]
cv2.imwrite(out,np.vstack(rows))
