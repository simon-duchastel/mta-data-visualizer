# build the ./website binary
website : website-upload-tool/main.go
	cd website-upload-tool; go build -o ../website  main.go 

# clear out ./website binary and public/ (website upload directory)
clean :
	-rm website
	-rm -rf public/*
