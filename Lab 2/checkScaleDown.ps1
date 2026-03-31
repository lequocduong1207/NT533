# URL cần gọi
$url = "http://192.168.121.89/"

# Số lần curl
$times = 5

for ($i = 1; $i -le $times; $i++) {
    Write-Host "$i :"

    $response = Invoke-WebRequest -Uri $url

    # Lấy tất cả thẻ <p>
    $pTags = $response.ParsedHtml.getElementsByTagName("p")

    foreach ($p in $pTags) {
        Write-Host $p.innerText
    }

    Write-Host ""
}